// Test de l'envoi des demandes de la page Contact (POST /api/contact), sans réseau extérieur :
//   npm run test:contact
// Un faux serveur SMTP local reçoit l'e-mail ; le vrai serveur du site est lancé sur un port libre avec un dossier de données temporaire.
const net = require('net');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

let echecs = 0;
const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? '✓' : '✗ ÉCHEC'}  ${nom}${detail ? '  → ' + detail : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const RACINE = path.join(__dirname, '..');

// Faux serveur SMTP : accepte tout, consigne les commandes et le message.
function fauxSmtp() {
  const recu = { commandes: [], message: '' };
  const serveur = net.createServer((s) => {
    s.setEncoding('utf8');
    s.on('error', () => {}); // le site est arrêté à la fin du test : connexions coupées sans importance
    s.write('220 faux-smtp pret\r\n');
    let enDonnees = false, tampon = '';
    s.on('data', (d) => {
      tampon += d;
      let i;
      while ((i = tampon.indexOf('\r\n')) !== -1) {
        const ligne = tampon.slice(0, i); tampon = tampon.slice(i + 2);
        if (enDonnees) {
          if (ligne === '.') { enDonnees = false; s.write('250 ok message accepte\r\n'); } else recu.message += ligne + '\r\n';
          continue;
        }
        recu.commandes.push(ligne);
        if (/^EHLO/.test(ligne)) s.write('250-faux\r\n250 AUTH LOGIN\r\n');
        else if (ligne === 'AUTH LOGIN') s.write('334 VXNlcm5hbWU6\r\n');
        else if (recu.commandes.at(-2) === 'AUTH LOGIN') s.write('334 UGFzc3dvcmQ6\r\n');
        else if (recu.commandes.at(-3) === 'AUTH LOGIN') s.write('235 ok\r\n');
        else if (/^MAIL FROM|^RCPT TO/.test(ligne)) s.write('250 ok\r\n');
        else if (ligne === 'DATA') { enDonnees = true; s.write('354 go\r\n'); }
        else if (ligne === 'QUIT') s.write('221 bye\r\n');
      }
    });
  });
  return new Promise((r) => serveur.listen(0, '127.0.0.1', () => r({ serveur, port: serveur.address().port, recu })));
}

function lancer(port, env) {
  const enfant = spawn(process.execPath, ['server.js'], { cwd: RACINE, env: { ...process.env, PORT: String(port), NOINDEX: '0', DB_PASS: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let sortie = '';
  enfant.stdout.on('data', (d) => { sortie += d; });
  enfant.stderr.on('data', (d) => { sortie += d; });
  return { enfant, sortie: () => sortie };
}

function requete(port, methode, corps, brut) {
  return new Promise((resolve) => {
    const donnees = brut !== undefined ? brut : (corps === undefined ? '' : JSON.stringify(corps));
    const r = http.request({ host: '127.0.0.1', port, path: '/api/contact', method: methode, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(donnees) } }, (res) => {
      let t = ''; res.on('data', (d) => { t += d; }); res.on('end', () => { let j = null; try { j = JSON.parse(t); } catch { /* pas du JSON */ } resolve({ code: res.statusCode, json: j }); });
    });
    r.on('error', () => resolve({ code: 0 }));
    r.end(donnees);
  });
}

const devis = (plus = {}) => ({ type: 'devis', services: ['Vidéo UGC', 'Site vitrine'], besoin: 'Je suis couvreur à Morlaix et je veux vendre en ligne.', delai: 'Dans les 3 mois', aide: true, nom: 'Jeanne Test', mail: 'jeanne@example.fr', tel: '0600000000', site: '', delaiRemplissage: 15000, ...plus });
const lignes = (fichier) => (fs.existsSync(fichier) ? fs.readFileSync(fichier, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

(async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'novae-contact-'));
  const fichier = path.join(dossier, 'demandes.jsonl');
  const smtp = await fauxSmtp();
  const PORT = 39211;
  const site = lancer(PORT, { DATA_DIR: dossier, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_SECURE: '0', SMTP_USER: 'contact@studionovae.org', SMTP_PASS: 'secret', MAIL_TO: 'contact@studionovae.org' });
  await attendre(1800);

  // --- demande de devis valide
  let r = await requete(PORT, 'POST', devis());
  ok('devis valide : réponse 200 { ok: true }', r.code === 200 && r.json && r.json.ok === true, JSON.stringify(r));
  await attendre(800);
  let l = lignes(fichier);
  ok('devis valide : enregistré dans demandes.jsonl', l.length >= 1 && l[0].type === 'devis' && l[0].nom === 'Jeanne Test' && l[0].services.join() === 'Vidéo UGC,Site vitrine', JSON.stringify(l[0] || {}).slice(0, 160));
  ok('devis valide : e-mail envoyé puis consigné', l.some((x) => x.courriel === 'envoye'));
  const cmds = smtp.recu.commandes;
  ok('SMTP : identifiants envoyés (AUTH LOGIN)', cmds.includes('AUTH LOGIN') && cmds.includes(Buffer.from('contact@studionovae.org').toString('base64')) && cmds.includes(Buffer.from('secret').toString('base64')));
  ok('SMTP : expéditeur et destinataire', cmds.includes('MAIL FROM:<contact@studionovae.org>') && cmds.includes('RCPT TO:<contact@studionovae.org>'));
  const msg = smtp.recu.message;
  ok('e-mail : Reply-To = adresse du visiteur', /Reply-To: <jeanne@example\.fr>/.test(msg));
  ok('e-mail : sujet encodé UTF-8', /Subject: =\?UTF-8\?B\?/.test(msg));
  const corps = Buffer.from(msg.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
  ok('e-mail : contenu complet (services, besoin, délai, aides, coordonnées)', ['Vidéo UGC, Site vitrine', 'couvreur à Morlaix', 'Dans les 3 mois', 'oui, à étudier', 'Jeanne Test', 'jeanne@example.fr', '0600000000'].every((t) => corps.includes(t)), corps.split('\n').slice(0, 3).join(' | '));

  // --- question
  r = await requete(PORT, 'POST', { type: 'question', nom: 'Paul', mail: 'paul@example.fr', message: 'Bonjour, une question.', site: '', delaiRemplissage: 9000 });
  ok('question valide : 200 et enregistrée', r.code === 200 && lignes(fichier).some((x) => x.type === 'question' && x.nom === 'Paul'));

  // --- refus
  const avant = lignes(fichier).length;
  r = await requete(PORT, 'POST', devis({ mail: 'pas-un-mail' }));
  ok('e-mail invalide : refusé (400) avec message', r.code === 400 && /e-mail/i.test(r.json.erreur), JSON.stringify(r.json));
  r = await requete(PORT, 'POST', devis({ services: ['Piratage'] }));
  ok('service inconnu : refusé (400)', r.code === 400);
  r = await requete(PORT, 'POST', devis({ besoin: '   ' }));
  ok('besoin vide : refusé (400)', r.code === 400);
  r = await requete(PORT, 'POST', devis({ nom: '' }));
  ok('nom vide : refusé (400)', r.code === 400);
  r = await requete(PORT, 'POST', undefined, '{pas du json');
  ok('JSON invalide : refusé (400)', r.code === 400);
  ok('aucun refus n\'est enregistré', lignes(fichier).length === avant);

  // --- pièges à robots : réponse « ok » mais rien d'enregistré
  r = await requete(PORT, 'POST', devis({ site: 'http://spam.example' }));
  const apresPiege1 = lignes(fichier).length;
  r = await requete(PORT, 'POST', devis({ delaiRemplissage: 300 }));
  ok('pièges à robots (champ caché, envoi instantané) : ok affiché, rien d\'enregistré', r.code === 200 && apresPiege1 === avant && lignes(fichier).length === avant);

  // --- injection d'en-têtes
  const avantInj = smtp.recu.message.length;
  r = await requete(PORT, 'POST', devis({ nom: 'Pirate\r\nBcc: victime@example.fr' }));
  await attendre(800);
  const nouveauMsg = smtp.recu.message.slice(avantInj);
  ok('injection d\'en-têtes (retour à la ligne dans le nom) : aucun en-tête Bcc créé', r.code === 200 && !/^Bcc:/m.test(nouveauMsg) && /^Subject: /m.test(nouveauMsg));

  // --- méthode et taille
  r = await requete(PORT, 'GET');
  ok('GET /api/contact : 405', r.code === 405);
  r = await requete(PORT, 'POST', devis({ besoin: 'x'.repeat(30000) }));
  ok('corps trop gros : refusé (413)', r.code === 413 || r.code === 0);

  // --- limite par adresse IP : 6 envois acceptés par heure (les refus de saisie ne comptent pas)
  let limite = null;
  for (let i = 0; i < 8 && !limite; i++) { const x = await requete(PORT, 'POST', devis()); if (x.code === 429) limite = x; }
  ok('limite par adresse IP : 429 après 6 envois acceptés', limite && limite.code === 429);

  site.enfant.kill();

  // --- sans identifiants SMTP : la demande est quand même enregistrée
  const dossier2 = fs.mkdtempSync(path.join(os.tmpdir(), 'novae-contact-'));
  const site2 = lancer(39212, { DATA_DIR: dossier2, SMTP_USER: '', SMTP_PASS: '' });
  await attendre(1800);
  r = await requete(39212, 'POST', devis());
  ok('sans SMTP configuré : 200 et demande enregistrée', r.code === 200 && lignes(path.join(dossier2, 'demandes.jsonl')).length === 1);
  ok('sans SMTP configuré : avertissement dans les journaux du serveur', /e-mail non envoyé/.test(site2.sortie()));
  site2.enfant.kill();

  // --- SMTP en panne : demande enregistrée et échec consigné
  const dossier3 = fs.mkdtempSync(path.join(os.tmpdir(), 'novae-contact-'));
  const site3 = lancer(39213, { DATA_DIR: dossier3, SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_SECURE: '0', SMTP_USER: 'u', SMTP_PASS: 'p' });
  await attendre(1800);
  r = await requete(39213, 'POST', devis());
  await attendre(1500);
  const l3 = lignes(path.join(dossier3, 'demandes.jsonl'));
  ok('SMTP en panne : le visiteur voit un succès, la demande est gardée, l\'échec est consigné', r.code === 200 && l3[0] && l3.some((x) => x.courriel === 'echec'), JSON.stringify(l3.slice(-1)));
  site3.enfant.kill();

  // --- courriel sortant : réponse à un client (destinataire libre, en-têtes de réponse, pièces jointes)
  {
    const courriel = require('../src/courriel');
    const base64 = (t) => Buffer.from(t, 'utf8').toString('base64');
    const simple = courriel.construireMessage({ de: 'contact@studionovae.org', a: 'client@exemple.fr', sujet: 'Re: Votre demande', texte: 'Bonjour' });
    ok('courriel : sans pièce jointe, message text/plain en base64 (comportement inchangé)', /^Content-Type: text\/plain; charset=UTF-8$/m.test(simple) && !/multipart/.test(simple) && simple.includes(base64('Bonjour')));
    const reponse = courriel.construireMessage({ de: 'contact@studionovae.org', a: 'client@exemple.fr', sujet: 'Re: x', texte: 'ok', enReponseA: '<abc@client.fr>', references: ['<un@x>', '<abc@client.fr>'], messageId: '<fixe@studionovae.org>' });
    ok('courriel : en-têtes In-Reply-To, References et Message-ID posés', /^In-Reply-To: <abc@client\.fr>$/m.test(reponse) && /^References: <un@x> <abc@client\.fr>$/m.test(reponse) && /^Message-ID: <fixe@studionovae\.org>$/m.test(reponse));
    const avecPj = courriel.construireMessage({ de: 'contact@studionovae.org', a: 'client@exemple.fr', sujet: 'Devis', texte: 'Voici', pieces: [{ nom: 'dev"is\r\nBcc: x@y.fr.pdf', typeMime: 'application/pdf', contenu: Buffer.from('%PDF-1.4 test') }] });
    const entetes = avecPj.split('\r\n\r\n')[0];
    const frontiere = (entetes.match(/boundary="([^"]+)"/) || [])[1];
    ok('courriel : avec pièce jointe, multipart/mixed avec frontière, texte et pièce en base64', /^Content-Type: multipart\/mixed; boundary=/m.test(entetes) && frontiere && avecPj.includes('--' + frontiere + '--') && avecPj.includes(base64('Voici')) && avecPj.includes(Buffer.from('%PDF-1.4 test').toString('base64')));
    ok('courriel : nom de pièce jointe avec retour à la ligne ou guillemets assaini', !/^Bcc:/m.test(avecPj) && /Content-Disposition: attachment; filename="[^"\r\n]*"/.test(avecPj));
    let refuse = false;
    try { courriel.construireMessage({ de: 'contact@studionovae.org', a: 'client@exemple.fr\r\nBcc: v@x.fr', sujet: 's', texte: 't' }); } catch { refuse = true; }
    ok('courriel : destinataire avec retour à la ligne refusé', refuse);
    const cfg = { hote: '127.0.0.1', port: smtp.port, securise: false, utilisateur: 'contact@studionovae.org', motDePasse: 'x', destinataire: 'contact@studionovae.org' };
    const avantCmd = smtp.recu.commandes.length;
    const envoye = await courriel.envoyer({ sujet: 'Re: Votre demande', texte: 'Bonjour', a: 'client@exemple.fr', enReponseA: '<abc@client.fr>' }, cfg);
    ok('courriel : envoyer livre au destinataire donné et renvoie le Message-ID posé dans l\'en-tête', smtp.recu.commandes.slice(avantCmd).includes('RCPT TO:<client@exemple.fr>') && /^<[^<>\s]+@studionovae\.org>$/.test(envoye.messageId) && envoye.brut.includes('Message-ID: ' + envoye.messageId));
  }

  // --- mail de réponse en HTML (gabarit validé par Rémi : en-tête bleu nuit, trait vert, signature, pied de page)
  {
    const courriel = require('../src/courriel');
    const html = courriel.htmlReponse('Bonjour Claire,\n\nVoici ma proposition.\nÀ bientôt.\n\n<script>alert(1)</script> & "guillemets"');
    const nb = (t, motif) => (t.match(motif) || []).length;
    ok('gabarit : logo « STUDIO · NOVAE » avec point vert vif, gras 700, interlettrage 0.04em (logo de l\'accueil)', /STUDIO <span style="[^"]*color:#a8dc5a[^"]*">·<\/span> NOVAE/.test(html) && /font-weight:700/.test(html) && /letter-spacing:0\.04em/.test(html));
    ok('gabarit : ligne de métier dans l\'en-tête ET dans le pied de page, trait vert sous l\'en-tête', nb(html, /Développement web, automatisation, marketing digital et conseil/g) === 2 && /background(-color)?:#a8dc5a|bgcolor="#a8dc5a"/.test(html));
    ok('gabarit : signature « Rémi » avec « Studio Novae · studionovae.org » et trait vertical gris-bleu devant', /Rémi/.test(html) && /border-left:4px solid #d5dbec/.test(html) && /Studio Novae · <a [^>]*>studionovae\.org<\/a>/.test(html));
    ok('gabarit : pied de page « studionovae.org · contact@studionovae.org »', /studionovae\.org<\/a> · <a [^>]*>contact@studionovae\.org/.test(html));
    ok('gabarit : le texte du message est échappé (aucune balise reçue n\'est interprétée), retours à la ligne conservés', !/<script>/.test(html) && /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;guillemets&quot;/.test(html) && /Voici ma proposition\.<br \/>À bientôt\./.test(html));
    const alternative = courriel.construireMessage({ de: 'contact@studionovae.org', a: 'client@exemple.fr', sujet: 'Re: x', texte: 'Bonjour', html: '<p>Bonjour</p>' });
    const entetesAlt = alternative.split('\r\n\r\n')[0];
    ok('courriel : texte + HTML → multipart/alternative avec les deux parties en base64', /^Content-Type: multipart\/alternative; boundary="/m.test(entetesAlt) && alternative.includes('Content-Type: text/plain; charset=UTF-8') && alternative.includes('Content-Type: text/html; charset=UTF-8') && alternative.includes(Buffer.from('<p>Bonjour</p>').toString('base64')));
    const mixte = courriel.construireMessage({ de: 'contact@studionovae.org', a: 'client@exemple.fr', sujet: 'Devis', texte: 'Voici', html: '<p>Voici</p>', pieces: [{ nom: 'devis.pdf', typeMime: 'application/pdf', contenu: Buffer.from('%PDF') }] });
    ok('courriel : texte + HTML + pièce jointe → multipart/mixed contenant multipart/alternative puis la pièce', /^Content-Type: multipart\/mixed; boundary="/m.test(mixte.split('\r\n\r\n')[0]) && /Content-Type: multipart\/alternative; boundary="/.test(mixte) && mixte.indexOf('multipart/alternative') < mixte.indexOf('application/pdf') && /filename="devis\.pdf"/.test(mixte));
    const frontieres = [...mixte.matchAll(/boundary="([^"]+)"/g)].map((m) => m[1]);
    ok('courriel : une frontière différente pour chaque niveau', frontieres.length === 2 && frontieres[0] !== frontieres[1]);
  }

  // --- rattachement à la conversation du client (faux pilote MySQL qui consigne les requêtes)
  {
    const base = require('../src/base');
    const apiContact = require('../src/api-contact');
    const demandeTest = { id: 'abc123def456', recueLe: new Date().toISOString(), ip: '1.2.3.4', type: 'devis', nom: 'Claire Martin', mail: 'Claire@Boulangerie.fr', services: ['Site vitrine'], besoin: 'Boulangerie', delai: '', aide: false };
    const fauxPilote = (panneMessage) => {
      const requetes = [];
      const reponseA = (sql) => {
        requetes.push(sql);
        if (panneMessage && /^INSERT INTO message/.test(sql)) throw new Error('panne simulée');
        if (/^INSERT INTO message/.test(sql)) return [{ insertId: 9 }];
        if (/FROM message/.test(sql)) return [[]];
        if (/FROM utilisateur|FROM conversation/.test(sql)) return [[{ id: 7, email: 'claire@boulangerie.fr' }]];
        return [[]];
      };
      return { requetes, query: async (sql) => reponseA(sql), execute: async (sql) => reponseA(sql) };
    };
    const pilote = fauxPilote(false);
    base._remplacerPilote(() => pilote);
    const resultat = await apiContact.enregistrerBase(demandeTest);
    ok('rattachement : la demande enregistrée est ajoutée à la conversation du client', resultat === true && pilote.requetes.some((s) => /^INSERT INTO message/.test(s)));
    const pilotePanne = fauxPilote(true);
    base._remplacerPilote(() => pilotePanne);
    let enregistree = null;
    try { enregistree = await apiContact.enregistrerBase(demandeTest); } catch { enregistree = 'exception'; }
    ok('rattachement : une panne du rattachement laisse la demande enregistrée (aucune erreur remontée)', enregistree === true);
    base._remplacerPilote(null);
  }

  smtp.serveur.close();
  console.log(echecs ? `\n✗ ${echecs} échec(s)` : '\n✓ envoi des demandes conforme');
  process.exit(echecs ? 1 : 0);
})();
