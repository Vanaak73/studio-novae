// Test de la relève de la boîte (src/releve.js) : conversion des e-mails reçus, rattachement aux conversations, doublons, pièces jointes, minuteur.
// Les lectures IMAP sont simulées ; les écritures se font dans une transaction annulée sur la base (.env.local). Sans base, les tests de données sont sautés.
//   npm run test:releve
require('../src/env').chargerTout();
const fs = require('fs');
const os = require('os');
const path = require('path');
const base = require('../src/base');
const { preparerSchema } = require('../src/schema');
const releve = require('../src/releve');
const cv = require('../src/conversations');

let echecs = 0;
const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? '✓' : '✗ ÉCHEC'}  ${nom}${detail ? '  → ' + detail : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function avecTransactionAnnulee(fn) {
  const connexion = await base.pool().getConnection();
  try { await connexion.beginTransaction(); await fn(connexion); } finally { await connexion.rollback(); connexion.release(); }
}

// Construit un e-mail brut. pieces : [{ nom, type, contenu: Buffer }]
function brut({ de = 'Claire <claire@boulangerie.fr>', objet = 'Bonjour', date = 'Wed, 05 Nov 2026 14:40:00 +0000', id = '<m1@client.fr>', texte, html, entetes = [], pieces = [] }) {
  const tete = [`From: ${de}`, 'To: contact@studionovae.org', `Subject: ${objet}`, `Date: ${date}`, ...(id ? [`Message-ID: ${id}`] : []), ...entetes, 'MIME-Version: 1.0'];
  if (!pieces.length) {
    if (html && !texte) return Buffer.from([...tete, 'Content-Type: text/html; charset=UTF-8', '', html].join('\r\n'));
    return Buffer.from([...tete, 'Content-Type: text/plain; charset=UTF-8', '', texte || 'Salut'].join('\r\n'));
  }
  const f = 'frontiere-test';
  const corps = [`--${f}`, 'Content-Type: text/plain; charset=UTF-8', '', texte || 'Voir pièce jointe'];
  for (const p of pieces) corps.push(`--${f}`, `Content-Type: ${p.type || 'application/octet-stream'}; name="${p.nom}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${p.nom}"`, '', p.contenu.toString('base64'));
  corps.push(`--${f}--`, '');
  return Buffer.from([...tete, `Content-Type: multipart/mixed; boundary="${f}"`, '', ...corps].join('\r\n'));
}

function contexte(messages, extra = {}) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'novae-releve-'));
  return {
    dossier,
    deps: {
      lireNouveaux: async (depuis) => messages.filter((m) => m.uid > depuis),
      dossierPieces: path.join(dossier, 'pieces'),
      fichierEtat: path.join(dossier, 'releve-etat.json'),
      maintenant: () => new Date('2026-11-05T15:00:00Z'),
      ...extra,
    },
  };
}

async function principal() {
  // ---- Conversion d'un e-mail (sans base)
  const maintenant = () => new Date('2026-11-05T15:00:00Z');
  const a = await releve.convertir(brut({ de: '"Claire Martin" <Claire@Boulangerie.FR>' }), maintenant);
  ok('convertir : From "Claire Martin" <Claire@Boulangerie.FR> → de normalisé', a.de === 'claire@boulangerie.fr');
  ok('convertir : objet, corps et date de l\'en-tête repris', a.objet === 'Bonjour' && /Salut/.test(a.corps) && a.date.toISOString() === '2026-11-05T14:40:00.000Z' && a.messageId === '<m1@client.fr>');
  const h = await releve.convertir(brut({ html: '<p>Bonjour <b>Rémi</b></p><script>alert(1)</script><style>p{color:red}</style>', id: '<h@x>' }), maintenant);
  ok('convertir : HTML seul → texte sans balises, <script> et <style> retirés', /Bonjour/.test(h.corps) && !/[<>]/.test(h.corps) && !/alert|color:red/.test(h.corps), JSON.stringify(h.corps));
  const s1 = await releve.convertir(brut({ id: null, texte: 'sans identifiant' }), maintenant);
  const s2 = await releve.convertir(brut({ id: null, texte: 'sans identifiant' }), maintenant);
  ok('convertir : sans Message-ID → empreinte stable (deux appels, même valeur)', s1.messageId && s1.messageId === s2.messageId && /^<[^<>\s]+>$/.test(s1.messageId), s1.messageId);
  const futur = await releve.convertir(brut({ date: 'Fri, 05 Nov 2027 10:00:00 +0000' }), maintenant);
  const sansDate = await releve.convertir(Buffer.from('From: a@b.fr\r\nSubject: x\r\nMessage-ID: <z@x>\r\n\r\ncorps'), maintenant);
  ok('convertir : Date future ou absente → date de réception', futur.date.getTime() === maintenant().getTime() && sansDate.date.getTime() === maintenant().getTime());
  const spf = await releve.convertir(brut({ entetes: ['Authentication-Results: mx.hostinger.com; spf=fail smtp.mailfrom=x.fr'] }), maintenant);
  const bon = await releve.convertir(brut({ entetes: ['Authentication-Results: mx.hostinger.com; spf=pass; dkim=pass'] }), maintenant);
  ok('convertir : spf=fail → authEchec ; spf=pass dkim=pass → pas d\'avertissement', spf.authEchec === true && bon.authEchec === false);
  const avecPj = await releve.convertir(brut({ pieces: [{ nom: 'devis.pdf', type: 'application/pdf', contenu: Buffer.from('%PDF-1.4') }] }), maintenant);
  ok('convertir : pièce jointe extraite (nom, type, contenu)', avecPj.pieces.length === 1 && avecPj.pieces[0].nom === 'devis.pdf' && avecPj.pieces[0].typeMime === 'application/pdf' && avecPj.pieces[0].contenu.toString() === '%PDF-1.4');

  // ---- Messages que la base refuserait, état, boîte propre (relecture finale)
  const longId = await releve.convertir(brut({ id: `<${'a'.repeat(300)}@x>` }), maintenant);
  ok('convertir : un Message-ID de plus de 255 caractères est remplacé par une empreinte', longId.messageId.length <= 255 && /^<[^<>\s]+>$/.test(longId.messageId));
  const ancien = await releve.convertir(brut({ date: 'Thu, 01 Jan 1900 00:00:00 +0000' }), maintenant);
  ok('convertir : une date antérieure à 1970 devient la date de réception', ancien.date.getTime() === maintenant().getTime());
  const enorme = await releve.convertir(brut({ texte: 'x'.repeat(600000), id: '<enorme@x>' }), maintenant);
  ok('convertir : un corps de plus de 500 000 caractères est tronqué', enorme.corps.length <= 500100 && /tronqué/.test(enorme.corps));
  {
    const ctx = contexte([]);
    let appels = 0, raide = true;
    ctx.deps.preparer = async () => { appels++; if (raide) { raide = false; throw new Error('base indisponible'); } };
    let erreur = null;
    try { await releve.passer({ db: {}, ...ctx.deps }); } catch (e) { erreur = e; }
    const suite = await releve.passer({ db: {}, ...ctx.deps });
    ok('passer : la préparation des tables est refaite à chaque passage (la relève reprend quand la base revient)', erreur && /indisponible/.test(erreur.message) && suite.ajoutes === 0 && appels === 2);
  }
  {
    let requetes = 0, panne = true;
    const db = { query: async () => { requetes++; if (panne) { panne = false; throw new Error('base indisponible'); } return [[]]; } };
    const preparer = releve.creerPreparateur(db);
    let echec = null;
    try { await preparer(); } catch (e) { echec = e; }
    await preparer();
    const apres = requetes;
    await preparer();
    ok('creerPreparateur : réessaie après une panne, puis ne refait plus rien une fois les tables prêtes', echec && /indisponible/.test(echec.message) && requetes === apres && apres > 5);
  }
  {
    const interdit = { query: async () => { throw new Error('la base ne doit pas être utilisée'); } };
    const ctx = contexte([{ uid: 4, brut: brut({ de: 'Studio Novae <contact@studionovae.org>', id: '<notif@studionovae.org>' }) }], { adresseBoite: 'Contact@StudioNovae.org' });
    const r = await releve.passer({ db: interdit, ...ctx.deps });
    ok('passer : les e-mails envoyés par la boîte elle-même (notifications du formulaire) sont ignorés', r.ajoutes === 0 && JSON.parse(fs.readFileSync(ctx.deps.fichierEtat, 'utf8')).dernierUid === 4);
  }
  {
    const propre = (uid) => ({ uid, brut: brut({ de: 'contact@studionovae.org', id: `<n${uid}@studionovae.org>` }) });
    const recus = [];
    const ctx = contexte([], { adresseBoite: 'contact@studionovae.org' });
    ctx.deps.lireNouveaux = async (depuis, validite) => { recus.push([depuis, validite]); return { messages: [propre(50)], uidValidity: 1 }; };
    await releve.passer({ db: {}, ...ctx.deps });
    ctx.deps.lireNouveaux = async (depuis, validite) => { recus.push([depuis, validite]); return { messages: [propre(3)], uidValidity: 2, reinitialise: true }; };
    await releve.passer({ db: {}, ...ctx.deps });
    const etat = JSON.parse(fs.readFileSync(ctx.deps.fichierEtat, 'utf8'));
    ok('passer : quand la boîte change de numérotation (UIDVALIDITY), la relève repart de zéro', recus[1][0] === 50 && recus[1][1] === 1 && etat.dernierUid === 3 && etat.uidValidity === 2, JSON.stringify(etat));
  }
  {
    const cassee = { query: async () => { throw new Error('INSERT refusé par la base'); } };
    const ctx = contexte([{ uid: 9, brut: brut({ id: '<poison@x>', de: 'poison@exemple.fr' }) }]);
    let refus = 0;
    for (let i = 0; i < 5; i++) { try { await releve.passer({ db: cassee, ...ctx.deps }); } catch { refus++; } }
    const sixieme = await releve.passer({ db: cassee, ...ctx.deps });
    ok('passer : un message que la base refuse 5 fois est ignoré (consigné) et ne bloque plus les suivants', refus === 5 && sixieme.ajoutes === 0 && JSON.parse(fs.readFileSync(ctx.deps.fichierEtat, 'utf8')).dernierUid === 9);
  }

  if (!base.estConfiguree()) { console.log('— base non configurée : tests de relève avec données sautés'); return; }
  await preparerSchema(base.pool());

  // ---- Passage de relève
  await avecTransactionAnnulee(async (c) => {
    const un = { uid: 1, brut: brut({ id: '<p1@x>', texte: 'Premier' }) };
    const ctx = contexte([un]);
    const r1 = await releve.passer({ db: c, ...ctx.deps });
    const { conversationId } = await cv.ouvrirConversation(c, 'claire@boulangerie.fr');
    let lue = await cv.lireConversation(c, conversationId);
    ok('passer : le premier passage importe les messages existants, marqués lus', r1.ajoutes === 1 && lue.messages.length === 1 && lue.messages[0].lu === true);

    ctx.deps.lireNouveaux = async (depuis) => [un, { uid: 2, brut: brut({ id: '<p2@x>', texte: 'Deuxième', date: 'Wed, 05 Nov 2026 14:50:00 +0000' }) }].filter((m) => m.uid > depuis);
    const r2 = await releve.passer({ db: c, ...ctx.deps });
    lue = await cv.lireConversation(c, conversationId);
    ok('passer : les passages suivants ajoutent des messages non lus (seulement les nouveaux)', r2.ajoutes === 1 && lue.messages.length === 2 && lue.messages[1].lu === false);

    // Même e-mail relevé deux fois (état effacé) : aucun doublon
    fs.rmSync(ctx.deps.fichierEtat);
    const r3 = await releve.passer({ db: c, ...ctx.deps });
    lue = await cv.lireConversation(c, conversationId);
    ok('passer : le même e-mail relevé deux fois → un seul message', r3.ajoutes === 0 && lue.messages.length === 2);
  });

  await avecTransactionAnnulee(async (c) => {
    const ctx = contexte([{ uid: 1, brut: brut({ id: '<c1@x>', de: 'conc@exemple.fr' }) }], { lireNouveaux: async (depuis) => { await attendre(80); return [{ uid: 1, brut: brut({ id: '<c1@x>', de: 'conc@exemple.fr' }) }].filter((m) => m.uid > depuis); } });
    const [p, q] = await Promise.all([releve.passer({ db: c, ...ctx.deps }), releve.passer({ db: c, ...ctx.deps })]);
    const { conversationId } = await cv.ouvrirConversation(c, 'conc@exemple.fr');
    ok('passer : deux passages simultanés → un seul traitement (le second renvoie ajoutes=0)', p.ajoutes + q.ajoutes === 1 && Math.min(p.ajoutes, q.ajoutes) === 0 && (await cv.lireConversation(c, conversationId)).messages.length === 1);
  });

  await avecTransactionAnnulee(async (c) => {
    const ctx = contexte([{ uid: 1, brut: brut({ id: '<pj@x>', de: 'pj@exemple.fr', pieces: [{ nom: '../../x.exe', contenu: Buffer.from('MZ') }, { nom: 'devis.pdf', type: 'application/pdf', contenu: Buffer.from('%PDF') }] }) }]);
    await releve.passer({ db: c, ...ctx.deps });
    const { conversationId } = await cv.ouvrirConversation(c, 'pj@exemple.fr');
    const lue = await cv.lireConversation(c, conversationId);
    const [lignes] = await c.query('SELECT nom, chemin FROM piece_jointe WHERE message_id = ?', [lue.messages[0].id]);
    const racine = path.resolve(ctx.deps.dossierPieces);
    const toutesDedans = lignes.length === 2 && lignes.every((l) => path.resolve(racine, l.chemin).startsWith(racine + path.sep) && fs.existsSync(path.resolve(racine, l.chemin)));
    ok('passer : nom de pièce jointe ../../x.exe → fichier écrit sous le dossier de stockage, nom assaini', toutesDedans && !fs.existsSync(path.join(ctx.dossier, 'x.exe')) && !fs.existsSync(path.join(os.tmpdir(), 'x.exe')), JSON.stringify(lignes));
    ok('passer : le contenu de la pièce jointe est conservé', fs.readFileSync(path.resolve(racine, lignes.find((l) => /devis/.test(l.nom)).chemin), 'utf8') === '%PDF');
  });

  await avecTransactionAnnulee(async (c) => {
    const gros = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    const ctx = contexte([{ uid: 1, brut: brut({ id: '<gros@x>', de: 'gros@exemple.fr', pieces: [{ nom: 'gros.bin', contenu: gros }] }) }]);
    await releve.passer({ db: c, ...ctx.deps });
    const { conversationId } = await cv.ouvrirConversation(c, 'gros@exemple.fr');
    const lue = await cv.lireConversation(c, conversationId);
    ok('passer : pièce jointe de plus de 10 Mo non stockée, message conservé avec mention dans le corps', lue.messages.length === 1 && lue.messages[0].piecesJointes.length === 0 && /gros\.bin/.test(lue.messages[0].corps) && /trop volumineuse/.test(lue.messages[0].corps));
  });

  await avecTransactionAnnulee(async (c) => {
    const un = { uid: 1, brut: brut({ id: '<soin@x>', de: 'soin@exemple.fr', pieces: [{ nom: 'devis.pdf', type: 'application/pdf', contenu: Buffer.from('%PDF') }] }) };
    const ctx = contexte([un]);
    const fichierBloquant = path.join(ctx.dossier, 'un-fichier');
    fs.writeFileSync(fichierBloquant, 'x');
    let panne = null;
    try { await releve.passer({ db: c, ...ctx.deps, dossierPieces: path.join(fichierBloquant, 'pieces') }); } catch (e) { panne = e; }
    await releve.passer({ db: c, ...ctx.deps });
    const { conversationId } = await cv.ouvrirConversation(c, 'soin@exemple.fr');
    const lue = await cv.lireConversation(c, conversationId);
    ok('passer : une panne d\'écriture des pièces jointes est rattrapée au passage suivant (le message ne reste pas sans son PDF)', !!panne && lue.messages.length === 1 && lue.messages[0].piecesJointes.length === 1);
  });

  await avecTransactionAnnulee(async (c) => {
    const ctx = contexte([], { lireNouveaux: async () => { throw new Error('IMAP : mot de passe refusé'); } });
    const [[{ avant }]] = await c.query('SELECT COUNT(*) AS avant FROM message');
    let erreur = null;
    try { await releve.passer({ db: c, ...ctx.deps }); } catch (e) { erreur = e; }
    const [[{ apres: apresCompte }]] = await c.query('SELECT COUNT(*) AS apres FROM message');
    ok('passer : lireNouveaux qui échoue → l\'erreur remonte, aucun message ni état enregistré', erreur && /refusé/.test(erreur.message) && !fs.existsSync(ctx.deps.fichierEtat) && Number(avant) === Number(apresCompte));
    // le verrou est libéré : un passage suivant fonctionne
    ctx.deps.lireNouveaux = async () => [];
    const apres = await releve.passer({ db: c, ...ctx.deps });
    ok('passer : après une erreur, le passage suivant s\'exécute normalement', apres.ajoutes === 0);
  });
}

principal().finally(() => (base.estConfiguree() ? base.pool().end() : null)).then(() => { console.log(echecs ? `\n✗ ${echecs} échec(s)` : '\n✓ relève conforme'); process.exit(echecs ? 1 : 0); },
  (e) => { console.error('Erreur :', e); process.exit(1); });
