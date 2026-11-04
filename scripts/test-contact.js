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

  smtp.serveur.close();
  console.log(echecs ? `\n✗ ${echecs} échec(s)` : '\n✓ envoi des demandes conforme');
  process.exit(echecs ? 1 : 0);
})();
