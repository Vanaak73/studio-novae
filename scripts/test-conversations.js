// Test des données utilisateurs, coordonnées et conversations (src/schema.js, utilisateurs.js, coordonnees.js, conversations.js).
// Les écritures se font dans une transaction annulée sur la vraie base (.env.local) : aucune ligne de test ne subsiste.
// Sans base configurée, les tests qui en ont besoin sont sautés.
//   npm run test:conversations
require('../src/env').chargerTout();
const base = require('../src/base');
const { preparerSchema } = require('../src/schema');

let echecs = 0;
const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? '✓' : '✗ ÉCHEC'}  ${nom}${detail ? '  → ' + detail : ''}`); };

async function avecTransactionAnnulee(fn) {
  const connexion = await base.pool().getConnection();
  try {
    await connexion.beginTransaction();
    await fn(connexion);
  } finally {
    await connexion.rollback();
    connexion.release();
  }
}

async function principal() {
  if (!base.estConfiguree()) {
    console.log('— base non configurée : tests de données sautés');
    return;
  }
  const db = base.pool();

  // ---- Schéma
  await preparerSchema(db);
  const [tables] = await db.query('SHOW TABLES');
  const noms = tables.map((l) => Object.values(l)[0]);
  ok('schéma : les 5 tables existent après preparerSchema', ['utilisateur', 'coordonnee', 'conversation', 'message', 'piece_jointe'].every((t) => noms.includes(t)));
  let deuxFois = true;
  try { await preparerSchema(db); } catch { deuxFois = false; }
  ok('schéma : preparerSchema deux fois sans erreur', deuxFois);

  // ---- Utilisateurs et mots de passe
  const u = require('../src/utilisateurs');
  const h1 = u.hacherMotDePasse('Un-mot-de-passe-solide');
  ok('hash : verifierMotDePasse accepte le bon et refuse le mauvais', u.verifierMotDePasse('Un-mot-de-passe-solide', h1) && !u.verifierMotDePasse('autre', h1));
  ok('hash : deux hachages du même mot de passe diffèrent', h1 !== u.hacherMotDePasse('Un-mot-de-passe-solide'));
  ok('hash : mdp vide en base refuse tout', !u.verifierMotDePasse('', null) && !u.verifierMotDePasse('x', null) && !u.verifierMotDePasse('x', ''));
  ok('email : "Claire Martin" <Claire@Boulangerie.FR> → claire@boulangerie.fr', u.normaliserEmail('"Claire Martin" <Claire@Boulangerie.FR>') === 'claire@boulangerie.fr');
  ok('email : texte sans @ → chaîne vide', u.normaliserEmail('pas une adresse') === '');
  await avecTransactionAnnulee(async (c) => {
    const a = await u.trouverOuCreer(c, 'Test.Un@Exemple.fr');
    const b = await u.trouverOuCreer(c, 'test.un@exemple.FR');
    ok('trouverOuCreer : casse différente → même id, statut utilisateur', a.id === b.id && a.statut === 'utilisateur' && a.email === 'test.un@exemple.fr');
    const ligne = await u.trouverParEmail(c, 'test.un@exemple.fr');
    ok('trouverOuCreer : mdp vide pour un client sans compte', ligne && ligne.mdp === null);
    const idAdmin = await u.creerAdmin(c, 'test.un@exemple.fr', 'Un-mot-de-passe-solide');
    const admin = await u.trouverParEmail(c, 'test.un@exemple.fr');
    ok('creerAdmin : promeut l\'utilisateur existant, mot de passe vérifiable', idAdmin === a.id && admin.statut === 'admin' && u.verifierMotDePasse('Un-mot-de-passe-solide', admin.mdp));
  });

  // ---- Coordonnées
  const co = require('../src/coordonnees');
  ok('coordonnées : url_site refuse javascript:alert(1)', co.TYPES.url_site('javascript:alert(1)') === null);
  ok('coordonnées : url_site accepte https://exemple.fr/a?b=1', co.TYPES.url_site('https://exemple.fr/a?b=1') === 'https://exemple.fr/a?b=1');
  ok('coordonnées : url_site refuse http:// seul', co.TYPES.url_site('http://') === null);
  ok('coordonnées : telephone "06 12 34 56 78" → +33612345678', co.TYPES.telephone('06 12 34 56 78') === '+33612345678');
  ok('coordonnées : telephone "abc" refusé', co.TYPES.telephone('abc') === null);
  ok('coordonnées : adresse de 300 caractères refusée (limite 200)', co.TYPES.adresse('a'.repeat(300)) === null && co.TYPES.adresse('12 rue des Lilas, 73000 Chambéry') !== null);
  ok('coordonnées : instagram accepte @identifiant et refuse une autre adresse de site', co.TYPES.instagram('@studio.novae') === '@studio.novae' && co.TYPES.instagram('https://exemple.fr/x') === null);
  await avecTransactionAnnulee(async (c) => {
    const util = await u.trouverOuCreer(c, 'coord@exemple.fr');
    let inconnu = false;
    try { await co.ajouterCoordonnee(c, util.id, 'pigeon', 'x'); } catch (e) { inconnu = /inconnu/.test(e.message); }
    ok('coordonnées : type inconnu refusé', inconnu);
    let refus = false;
    try { await co.ajouterCoordonnee(c, util.id, 'url_site', 'javascript:alert(1)'); } catch (e) { refus = /refusée/.test(e.message); }
    ok('coordonnées : valeur refusée remonte une erreur et rien n\'est enregistré', refus && (await co.lireCoordonnees(c, util.id)).length === 0);
    await co.ajouterCoordonnee(c, util.id, 'telephone', '06 12 34 56 78');
    await co.ajouterCoordonnee(c, util.id, 'telephone', '04 79 00 00 00');
    const liste = await co.lireCoordonnees(c, util.id);
    ok('coordonnées : deux téléphones pour un même utilisateur acceptés', liste.length === 2 && liste.every((l) => l.type === 'telephone'));
  });

  // ---- Conversations
  const cv = require('../src/conversations');
  const d = (h, m = 0) => new Date(Date.UTC(2026, 10, 5, h, m));
  const dans = (liste, id) => liste.find((l) => l.id === id);
  await avecTransactionAnnulee(async (c) => {
    const { conversationId: c1 } = await cv.ouvrirConversation(c, 'Claire@Boulangerie.fr');
    const { conversationId: c1b } = await cv.ouvrirConversation(c, 'claire@boulangerie.FR');
    ok('conversations : ouvrirConversation avec casse différente → même conversation', c1 === c1b);

    await cv.ajouterMessage(c, c1, { sens: 'entrant', corps: 'Second', envoyeLe: d(14, 40), messageIdEmail: '<m2@x>' });
    await cv.ajouterMessage(c, c1, { sens: 'sortant', corps: 'Premier', envoyeLe: d(10, 12), messageIdEmail: '<m1@x>', lu: true });
    const lue = await cv.lireConversation(c, c1);
    ok('conversations : deux messages dans le désordre sont lus dans l\'ordre de leur date', lue.messages.map((m) => m.corps).join(',') === 'Premier,Second');

    const doublon = await cv.ajouterMessage(c, c1, { sens: 'entrant', corps: 'Second', envoyeLe: d(14, 40), messageIdEmail: '<m2@x>' });
    const apres = await cv.lireConversation(c, c1);
    ok('conversations : même messageIdEmail deux fois → nouveau=false, un seul message', doublon.nouveau === false && apres.messages.length === 2);

    const l1 = dans(await cv.listerConversations(c, 'toutes'), c1);
    ok('conversations : le compteur de non lues ne compte que les entrants non lus', l1 && l1.nonLus === 1);
    ok('conversations : sansDemande vrai pour une conversation d\'e-mails seuls', l1.sansDemande === true && l1.nbDemandes === 0);
    ok('conversations : la liste reflète le dernier message (aperçu, date)', l1.apercu === 'Second' && l1.dernierLe.getTime() === d(14, 40).getTime());

    await cv.marquerLu(c, c1);
    ok('conversations : marquerLu remet le compteur à zéro', dans(await cv.listerConversations(c, 'toutes'), c1).nonLus === 0
      && !dans(await cv.listerConversations(c, 'non_lues'), c1));

    const demande = { id: 'test' + Date.now().toString(16).slice(-8), recueLe: d(9, 58).toISOString(), type: 'devis', nom: 'Claire Martin', mail: 'claire@boulangerie.fr', tel: '0612345678', services: ['Site vitrine'], besoin: 'Boulangerie, 5 pages', delai: 'Dès que possible', aide: false };
    await cv.rattacherDemande(c, demande);
    await cv.rattacherDemande(c, demande);
    const avecDemande = await cv.lireConversation(c, c1);
    const nbDem = avecDemande.messages.filter((m) => m.nature === 'demande').length;
    ok('conversations : rattacherDemande deux fois → un seul message de nature demande', nbDem === 1);
    ok('conversations : la demande est datée de son enregistrement et placée avant les e-mails suivants', avecDemande.messages[0].nature === 'demande' && /Boulangerie, 5 pages/.test(avecDemande.messages[0].corps));
    const filtreDevis = await cv.listerConversations(c, 'devis');
    ok('conversations : filtre devis ne renvoie que les conversations avec une demande', dans(filtreDevis, c1) && dans(filtreDevis, c1).nbDemandes === 1 && !dans(filtreDevis, c1).sansDemande);
    ok('conversations : le nom du client vient de sa demande', dans(filtreDevis, c1).nom === 'Claire Martin');

    const { conversationId: c2 } = await cv.ouvrirConversation(c, 'autre@exemple.fr');
    await cv.ajouterMessage(c, c2, { sens: 'entrant', corps: 'Bonjour', envoyeLe: d(8), messageIdEmail: '<a@x>' });
    ok('conversations : filtre devis exclut une conversation sans demande', !dans(await cv.listerConversations(c, 'devis'), c2));

    await cv.archiver(c, c2, true);
    ok('conversations : archiver retire la conversation de la liste par défaut', !dans(await cv.listerConversations(c, 'toutes'), c2)
      && dans(await cv.listerConversations(c, 'toutes', true), c2));
    ok('conversations : les messages d\'une conversation archivée restent', (await cv.lireConversation(c, c2)).messages.length === 1);
    await cv.ajouterMessage(c, c2, { sens: 'entrant', corps: 'Encore moi', envoyeLe: d(9), messageIdEmail: '<b@x>' });
    ok('conversations : un expéditeur archivé sans échange reste archivé', !dans(await cv.listerConversations(c, 'toutes'), c2));
    await cv.ajouterMessage(c, c1, { sens: 'sortant', corps: 'Réponse', envoyeLe: d(15), messageIdEmail: '<r@x>', lu: true });
    await cv.archiver(c, c1, true);
    await cv.ajouterMessage(c, c1, { sens: 'entrant', corps: 'Merci', envoyeLe: d(16), messageIdEmail: '<t@x>' });
    ok('conversations : un client avec échanges réapparaît quand il écrit', !!dans(await cv.listerConversations(c, 'toutes'), c1));

    const dangereux = '<script>alert(1)</script> & "guillemets"';
    await cv.ajouterMessage(c, c1, { sens: 'entrant', corps: dangereux, envoyeLe: d(17), messageIdEmail: '<x@x>' });
    const relu = await cv.lireConversation(c, c1);
    ok('conversations : un corps avec <script> est relu à l\'identique (aucune transformation en base)', relu.messages[relu.messages.length - 1].corps === dangereux);

    const idPj = await cv.ajouterPieceJointe(c, relu.messages[0].id, { nom: 'devis.pdf', typeMime: 'application/pdf', taille: 1234, chemin: '2026/11/abc-devis.pdf' });
    const avecPj = await cv.lireConversation(c, c1);
    ok('conversations : une pièce jointe est listée avec son message', idPj > 0 && avecPj.messages[0].piecesJointes.length === 1 && avecPj.messages[0].piecesJointes[0].nom === 'devis.pdf');
  });

  // ---- FIN
}

principal().finally(() => (base.estConfiguree() ? base.pool().end() : null)).then(() => { console.log(echecs ? `\n✗ ${echecs} échec(s)` : '\n✓ données conformes'); process.exit(echecs ? 1 : 0); },
  (e) => { console.error('Erreur :', e); process.exit(1); });
