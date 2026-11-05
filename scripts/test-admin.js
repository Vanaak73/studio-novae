// Test de l'administration : sessions et connexion (src/session.js), routes (src/admin.js), page (src/pages/admin.js).
// Les écritures se font dans une transaction annulée sur la base (.env.local) ; sans base, les tests de données sont sautés.
//   npm run test:admin
require('../src/env').chargerTout();
const base = require('../src/base');
const { preparerSchema } = require('../src/schema');
const session = require('../src/session');
const u = require('../src/utilisateurs');

let echecs = 0;
const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? '✓' : '✗ ÉCHEC'}  ${nom}${detail ? '  → ' + detail : ''}`); };

async function avecTransactionAnnulee(fn) {
  const connexion = await base.pool().getConnection();
  try { await connexion.beginTransaction(); await fn(connexion); } finally { await connexion.rollback(); connexion.release(); }
}

const SECRET = 'a'.repeat(40);
const HEURE = 3600 * 1000;

async function principal() {
  // ---- Sessions (sans base)
  const t0 = 1_800_000_000_000;
  const s = session.creerSession(7, SECRET, t0);
  const entete = `autre=1; novae_session=${s.cookie}; encore=2`;
  const lue = session.lireSession(entete, SECRET, t0 + 1000);
  ok('session : un cookie valide est relu (identifiant et jeton CSRF)', lue && lue.utilisateurId === 7 && lue.csrf === s.csrf && /^[0-9a-f]{32,}$/.test(s.csrf));
  const falsifie = s.cookie.replace(/^[^.]+/, Buffer.from(JSON.stringify({ u: 1, exp: t0 + 8 * HEURE, csrf: s.csrf })).toString('base64url'));
  ok('session : cookie falsifié refusé', session.lireSession(`novae_session=${falsifie}`, SECRET, t0 + 1000) === null);
  ok('session : session expirée après 8 h', session.lireSession(entete, SECRET, t0 + 8 * HEURE - 1) !== null && session.lireSession(entete, SECRET, t0 + 8 * HEURE + 1) === null);
  ok('session : cookie rejoué avec un autre secret refusé', session.lireSession(entete, 'b'.repeat(40), t0 + 1000) === null);
  ok('session : en-tête absent ou sans cookie de session → null', session.lireSession(undefined, SECRET, t0) === null && session.lireSession('autre=1', SECRET, t0) === null);
  let secretCourt = false;
  try { session.creerSession(1, 'court', t0); } catch { secretCourt = true; }
  ok('session : secret de moins de 32 caractères refusé', secretCourt);

  // ---- Limiteur de tentatives (sans base)
  const lim = session.creerLimiteur();
  for (let i = 0; i < 5; i++) lim.echec('mail:x@y.fr', t0);
  ok('limiteur : bloqué après 5 échecs', lim.bloque('mail:x@y.fr', t0 + 1000) === true && lim.bloque('mail:autre@y.fr', t0 + 1000) === false);
  ok('limiteur : blocage levé après 15 min', lim.bloque('mail:x@y.fr', t0 + 15 * 60 * 1000 + 1) === false);
  const lim2 = session.creerLimiteur();
  lim2.echec('ip:1.1.1.1', t0); lim2.reussite('ip:1.1.1.1');
  for (let i = 0; i < 4; i++) lim2.echec('ip:1.1.1.1', t0);
  ok('limiteur : une réussite remet le compteur à zéro', lim2.bloque('ip:1.1.1.1', t0) === false);

  // ---- Page d'administration (sans base)
  const { pageAdmin } = require('../src/pages/admin');
  const connectee = pageAdmin({ connecte: true, csrf: 'jeton-csrf-test', email: 'remi@exemple.fr' });
  ok('page connectée : bandeau « Page d\'administration », titre « Administration », onglet « Conversations » actif',
    /Page d'administration/.test(connectee) && /<h1[^>]*>Administration<\/h1>/.test(connectee) && /<[^>]*aria-selected="true"[^>]*>Conversations</.test(connectee));
  ok('page connectée : onglets à venir présents (Utilisateurs, Autres outils), jeton CSRF fourni au script', /Utilisateurs/.test(connectee) && /Autres outils/.test(connectee) && /<meta name="csrf" content="jeton-csrf-test"/.test(connectee));
  const sortie = pageAdmin({ connecte: false });
  ok("page : le bouton « Nouveau message » est présent pour l'administrateur connecté seulement", /id="nouveau-message"/.test(connectee) && !/id="nouveau-message"/.test(pageAdmin({ connecte: false })));
  ok('page non connectée : formulaire de connexion seul, ni conversations ni jeton', /<form[^>]*id="connexion"/.test(sortie) && !/id="liste-conversations"/.test(sortie) && !/name="csrf"/.test(sortie));
  ok('page d\'administration : feuille de style et script versionnés (?v=<empreinte>)', /href="\/assets\/css\/admin\.css\?v=[0-9a-f]{8}"/.test(connectee) && /src="\/assets\/js\/admin\.js\?v=[0-9a-f]{8}"/.test(connectee) && /href="\/assets\/css\/admin\.css\?v=[0-9a-f]{8}"/.test(sortie));
  ok('pages : <meta name="robots" content="noindex"> sur les deux', /<meta name="robots" content="noindex/.test(connectee) && /<meta name="robots" content="noindex/.test(sortie));
  ok('page : un e-mail hostile est échappé dans la page', !/<script>alert/.test(pageAdmin({ connecte: true, csrf: 'x', email: '<script>alert(1)</script>' })));
  const scriptAdmin = fs.readFileSync(path.join(__dirname, '..', 'public_html', 'assets', 'js', 'admin.js'), 'utf8');
  ok('admin.js : aucun innerHTML, insertAdjacentHTML ni document.write (le contenu reçu s\'affiche via textContent)', !/innerHTML|insertAdjacentHTML|document\.write|outerHTML/.test(scriptAdmin));
  const rendu = require('../src/rendu');
  rendu.demarrer();
  const robots = rendu.pages().get('/robots.txt').corps;
  const plan = rendu.pages().get('/sitemap.xml').corps;
  const renduLogo = require('../src/rendu');
  renduLogo.demarrer();
  const logoAccueil = (renduLogo.pages().get('/').corps.match(/<a class="logo"[^>]*>[\s\S]*?<\/a>/) || [])[0];
  const logoAdmin = (connectee.match(/<a class="logo"[^>]*>[\s\S]*?<\/a>/) || [])[0];
  ok("logo : le logo de l'administration est la copie exacte de celui de l'accueil (même HTML)", !!logoAccueil && logoAccueil === logoAdmin, `${logoAccueil} / ${logoAdmin}`);
  const cssSite = fs.readFileSync(path.join(__dirname, '..', 'public_html', 'assets', 'css', 'style.css'), 'utf8');
  const cssAdmin = fs.readFileSync(path.join(__dirname, '..', 'public_html', 'assets', 'css', 'admin.css'), 'utf8');
  const regleLogo = (css, sel) => (css.match(new RegExp(`^${sel.replace(/\./g, '\\.')} \\{[^}]*\\}`, 'm')) || [''])[0].replace(/\s+/g, ' ');
  ok("logo : les règles CSS .logo et .logo span de l'administration sont celles de l'accueil (mêmes valeurs)", regleLogo(cssSite, '.logo') !== '' && regleLogo(cssSite, '.logo') === regleLogo(cssAdmin, '.logo') && regleLogo(cssSite, '.logo span') === regleLogo(cssAdmin, '.logo span'));
  const intervalle = Number((scriptAdmin.match(/INTERVALLE_MS\s*=\s*(\d+)/) || [])[1]);
  ok("admin.js : la page actualise la boîte à l'ouverture et à intervalle régulier (appel de /admin/api/actualiser, intervalle de 20 s au plus)", /\/admin\/api\/actualiser/.test(scriptAdmin) && intervalle > 0 && intervalle <= 20000);
  ok('/admin absent de /sitemap.xml ; robots.txt contient Disallow: /admin/', !/admin/.test(plan) && /^Disallow: \/admin\/$/m.test(robots));

  if (!base.estConfiguree()) { console.log('— base non configurée : tests de connexion sautés'); return; }
  await preparerSchema(base.pool());

  // ---- Connexion
  await avecTransactionAnnulee(async (c) => {
    await u.creerAdmin(c, 'admin.test@exemple.fr', 'Mot-de-passe-admin-1');
    await u.trouverOuCreer(c, 'client.test@exemple.fr');
    await c.query('UPDATE utilisateur SET mdp = ? WHERE email = ?', [u.hacherMotDePasse('Mot-de-passe-client-1'), 'client.test@exemple.fr']);

    const bon = await session.connecter(c, 'Admin.Test@exemple.fr', 'Mot-de-passe-admin-1', '1.2.3.4', SECRET, { limiteur: session.creerLimiteur(), maintenant: t0 });
    ok('connexion : un admin avec le bon mot de passe obtient une session', bon.cookie && bon.csrf && session.lireSession(`novae_session=${bon.cookie}`, SECRET, t0 + 1).utilisateurId > 0);

    const mauvais = await session.connecter(c, 'admin.test@exemple.fr', 'faux', '1.2.3.4', SECRET, { limiteur: session.creerLimiteur(), maintenant: t0 });
    const inconnu = await session.connecter(c, 'personne@exemple.fr', 'faux', '1.2.3.4', SECRET, { limiteur: session.creerLimiteur(), maintenant: t0 });
    const client = await session.connecter(c, 'client.test@exemple.fr', 'Mot-de-passe-client-1', '1.2.3.4', SECRET, { limiteur: session.creerLimiteur(), maintenant: t0 });
    ok('connexion : mauvais mot de passe, adresse inconnue et statut utilisateur reçoivent le même message', mauvais.erreur && mauvais.erreur === inconnu.erreur && inconnu.erreur === client.erreur && !mauvais.cookie && !client.cookie, mauvais.erreur);

    const limiteur = session.creerLimiteur();
    for (let i = 0; i < 5; i++) await session.connecter(c, 'admin.test@exemple.fr', 'faux', '9.9.9.9', SECRET, { limiteur, maintenant: t0 });
    const sixieme = await session.connecter(c, 'admin.test@exemple.fr', 'Mot-de-passe-admin-1', '9.9.9.9', SECRET, { limiteur, maintenant: t0 + 1000 });
    ok('connexion : la 6e tentative est bloquée même avec le bon mot de passe', !!sixieme.erreur && !sixieme.cookie && /tentatives/i.test(sixieme.erreur));
    const apres = await session.connecter(c, 'admin.test@exemple.fr', 'Mot-de-passe-admin-1', '9.9.9.9', SECRET, { limiteur, maintenant: t0 + 15 * 60 * 1000 + 5000 });
    ok('connexion : le blocage est levé après 15 min', !!apres.cookie);
  });
}

// ---- Routes d'administration (serveur HTTP local, base en transaction annulée, courriel simulé)
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

function requete(port, methode, chemin, { corps, cookie, csrf, brut } = {}) {
  return new Promise((resolve) => {
    const donnees = brut !== undefined ? brut : corps !== undefined ? JSON.stringify(corps) : undefined;
    const entetes = { ...(donnees !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF': csrf } : {}) };
    const r = http.request({ host: '127.0.0.1', port, method: methode, path: chemin, headers: entetes, agent: false }, (res) => { // agent: false = une connexion par requête (le serveur coupe la connexion après un corps trop gros)
      const morceaux = [];
      res.on('data', (c) => morceaux.push(c));
      res.on('end', () => {
        const texte = Buffer.concat(morceaux);
        let json = null;
        try { json = JSON.parse(texte.toString('utf8')); } catch { /* pas du JSON */ }
        resolve({ code: res.statusCode, entetes: res.headers, texte: texte.toString('utf8'), binaire: texte, json });
      });
    });
    r.on('error', () => resolve({ code: 0 }));
    r.end(donnees);
  });
}

async function testerRoutes() {
  const admin = require('../src/admin');
  const cv = require('../src/conversations');
  await avecTransactionAnnulee(async (c) => {
    await u.creerAdmin(c, 'admin.routes@exemple.fr', 'Mot-de-passe-admin-1');
    const dossierPieces = fs.mkdtempSync(path.join(os.tmpdir(), 'novae-pieces-'));
    const envois = [];
    let panneSmtp = false, panneCopie = false, horloge = 1_800_000_000_000, appelsActualiser = 0, panneActualiser = false;
    const deps = {
      db: c, secret: SECRET, dossierPieces, limiteur: session.creerLimiteur(),
      maintenant: () => horloge,
      actualiser: async () => { appelsActualiser++; if (panneActualiser) throw new Error("IMAP : mot de passe refusé"); return { ajoutes: 2 }; },
      envoyerCourriel: async (opts) => { envois.push(opts); if (panneSmtp) throw new Error('SMTP : connexion refusée'); return { messageId: `<sortant${envois.length}@studionovae.org>`, brut: 'MESSAGE BRUT' }; },
      copierEnvoyes: async () => { if (panneCopie) throw new Error('IMAP : dossier Envoyés introuvable'); },
    };
    const serveur = http.createServer((req, res) => admin.traiter(req, res, deps));
    await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
    const port = serveur.address().port;
    try {
      // Sans session
      let r = await requete(port, 'GET', '/admin/api/conversations');
      ok('routes : sans cookie, /admin/api/conversations → 401', r.code === 401);
      r = await requete(port, 'GET', '/admin/');
      ok('routes : GET /admin/ sans session → page de connexion (200, HTML, no-store, noindex)', r.code === 200 && /text\/html/.test(r.entetes['content-type']) && /id="connexion"/.test(r.texte) && /no-store/.test(r.entetes['cache-control']) && /noindex/.test(r.entetes['x-robots-tag']));

      // Connexion
      r = await requete(port, 'POST', '/admin/connexion', { corps: { email: 'admin.routes@exemple.fr', mdp: 'faux' } });
      const refus = r;
      r = await requete(port, 'POST', '/admin/connexion', { corps: { email: 'admin.routes@exemple.fr', mdp: 'Mot-de-passe-admin-1' } });
      const pose = String((r.entetes['set-cookie'] || [])[0] || '');
      ok('routes : connexion refusée → 401 sans cookie ; réussie → cookie HttpOnly, Secure, SameSite=Strict', refus.code === 401 && !refus.entetes['set-cookie'] && r.code === 200 && /novae_session=/.test(pose) && /HttpOnly/.test(pose) && /Secure/.test(pose) && /SameSite=Strict/.test(pose) && /Path=\/admin/.test(pose), pose.replace(/=[^;]+/, '=…'));
      const grosse = await requete(port, 'POST', '/admin/connexion', { corps: { email: 'x@y.fr', mdp: 'x'.repeat(10000) } });
      ok('routes : un corps de connexion de plus de 4 Ko est refusé (413) avant toute vérification', grosse.code === 413 || grosse.code === 0);
      const cookie = pose.split(';')[0];
      const csrf = r.json.csrf;
      ok('routes : la connexion renvoie le jeton CSRF', typeof csrf === 'string' && csrf.length >= 32);
      r = await requete(port, 'GET', '/admin/', { cookie });
      ok('routes : GET /admin/ avec session → page d\'administration portant le jeton CSRF de la session', r.code === 200 && /id="liste-conversations"/.test(r.texte) && r.texte.includes(`<meta name="csrf" content="${csrf}"`));

      // Données de départ
      const { conversationId } = await cv.ouvrirConversation(c, 'client.routes@exemple.fr');
      const dangereux = '<script>alert(1)</script> & "x"';
      await cv.ajouterMessage(c, conversationId, { sens: 'entrant', objet: 'Bonjour', corps: dangereux, envoyeLe: new Date('2026-11-05T14:40:00Z'), messageIdEmail: '<entrant1@client.fr>' });

      r = await requete(port, 'GET', '/admin/api/conversations?filtre=non_lues', { cookie });
      ok('routes : la liste des conversations non lues contient le client', r.code === 200 && r.json.conversations.some((x) => x.id === conversationId && x.nonLus === 1));
      r = await requete(port, 'GET', `/admin/api/conversations/${conversationId}`, { cookie });
      ok('routes : le corps contenant <script> est renvoyé tel quel en JSON', r.code === 200 && r.json.messages[0].corps === dangereux && /application\/json/.test(r.entetes['content-type']) && /no-store/.test(r.entetes['cache-control']) && /noindex/.test(r.entetes['x-robots-tag']));
      r = await requete(port, 'GET', '/admin/api/conversations?filtre=non_lues', { cookie });
      ok('routes : ouvrir la conversation la marque lue', !r.json.conversations.some((x) => x.id === conversationId));

      // CSRF
      r = await requete(port, 'POST', `/admin/api/conversations/${conversationId}/reponse`, { cookie, corps: { texte: 'Bonjour' } });
      ok('routes : POST sans X-CSRF → 403 et rien n\'est envoyé', r.code === 403 && envois.length === 0);
      r = await requete(port, 'POST', `/admin/api/conversations/${conversationId}/reponse`, { cookie, csrf, brut: 'texte=Bonjour' });
      ok('routes : POST dont le contenu n\'est pas du JSON → 400', r.code === 400 || r.code === 415);

      // Réponse
      r = await requete(port, 'POST', `/admin/api/conversations/${conversationId}/reponse`, { cookie, csrf, corps: { texte: 'Bonjour Claire', a: 'pirate@exemple.fr' } });
      const lu = await cv.lireConversation(c, conversationId);
      const sortant = lu.messages.find((m) => m.sens === 'sortant');
      ok('routes : la réponse part avec le gabarit HTML (logo, texte échappé) en plus du texte brut', typeof envois[0].html === 'string' && /STUDIO <span/.test(envois[0].html) && envois[0].html.includes('Bonjour Claire') && /Rémi/.test(envois[0].texte));
      ok('routes : la réponse part vers l\'e-mail de la conversation (jamais un destinataire fourni par le client HTTP)', r.code === 200 && envois.length === 1 && envois[0].a === 'client.routes@exemple.fr');
      ok('routes : le message sortant est enregistré avec son Message-ID, et la réponse porte In-Reply-To du dernier message reçu', sortant && sortant.statutEnvoi === 'envoye' && sortant.messageIdEmail === '<sortant1@studionovae.org>' && envois[0].enReponseA === '<entrant1@client.fr>' && envois[0].sujet === 'Re: Bonjour');

      // Échec SMTP puis renvoi
      panneSmtp = true;
      r = await requete(port, 'POST', `/admin/api/conversations/${conversationId}/reponse`, { cookie, csrf, corps: { texte: 'Deuxième réponse' } });
      let apres = await cv.lireConversation(c, conversationId);
      const echec = apres.messages.find((m) => m.corps === 'Deuxième réponse');
      ok('routes : échec SMTP → statut echec, erreur consignée, réponse HTTP explicite', r.code === 200 && r.json.ok === false && echec && echec.statutEnvoi === 'echec' && /refusée/.test(echec.erreur));
      panneSmtp = false;
      r = await requete(port, 'POST', `/admin/api/conversations/${conversationId}/renvoyer/${echec.id}`, { cookie, csrf, corps: {} });
      apres = await cv.lireConversation(c, conversationId);
      ok('routes : renvoyer fait passer le message à envoye', r.code === 200 && apres.messages.find((m) => m.id === echec.id).statutEnvoi === 'envoye');

      // Copie « Envoyés » en panne : l'envoi reste valide
      panneCopie = true;
      r = await requete(port, 'POST', `/admin/api/conversations/${conversationId}/reponse`, { cookie, csrf, corps: { texte: 'Troisième' } });
      ok('routes : échec de la copie dans « Envoyés » n\'annule pas l\'envoi', r.code === 200 && r.json.ok === true);
      panneCopie = false;

      // Pièces jointes
      const pdf = Buffer.from('%PDF-1.4 devis');
      r = await requete(port, 'POST', `/admin/api/conversations/${conversationId}/reponse`, { cookie, csrf, corps: { texte: 'Voici le devis', pieces: [{ nom: '../devis.pdf', typeMime: 'application/pdf', base64: pdf.toString('base64') }] } });
      const dernierEnvoi = envois[envois.length - 1];
      apres = await cv.lireConversation(c, conversationId);
      const avecPj = apres.messages.find((m) => m.corps === 'Voici le devis');
      ok('routes : la pièce jointe est envoyée et enregistrée', r.code === 200 && dernierEnvoi.pieces.length === 1 && dernierEnvoi.pieces[0].contenu.equals(pdf) && avecPj.piecesJointes.length === 1);
      r = await requete(port, 'GET', `/admin/pieces/${avecPj.piecesJointes[0].id}`, { cookie });
      ok('routes : le téléchargement est forcé (attachment, nosniff) et le contenu intact', r.code === 200 && /^attachment;/.test(r.entetes['content-disposition']) && r.entetes['x-content-type-options'] === 'nosniff' && r.binaire.equals(pdf));
      const trop = Buffer.alloc(10 * 1024 * 1024 + 1, 7).toString('base64');
      r = await requete(port, 'POST', `/admin/api/conversations/${conversationId}/reponse`, { cookie, csrf, corps: { texte: 'Trop gros', pieces: [{ nom: 'gros.bin', typeMime: 'application/octet-stream', base64: trop }] } });
      ok('routes : pièce jointe de plus de 10 Mo → 413', r.code === 413);

      // Pièce hors du dossier de stockage
      const [ins] = await c.query('INSERT INTO piece_jointe (message_id, nom, type_mime, taille, chemin) VALUES (?, ?, ?, ?, ?)', [avecPj.id, 'secret.txt', 'text/plain', 3, '../../secret.txt']);
      r = await requete(port, 'GET', `/admin/pieces/${ins.insertId}`, { cookie });
      ok('routes : une pièce dont le chemin sort du dossier de stockage → 404', r.code === 404);

      // Actualisation de la boîte (relève à la demande, appelée par la page à l'ouverture puis régulièrement)
      r = await requete(port, 'POST', '/admin/api/actualiser', { cookie, corps: {} });
      ok('routes : actualiser sans X-CSRF → 403 et aucune relève', r.code === 403 && appelsActualiser === 0);
      r = await requete(port, 'POST', '/admin/api/actualiser', { cookie, csrf, corps: {} });
      ok('routes : actualiser lance la relève et renvoie le nombre de messages ajoutés', r.code === 200 && r.json.ok === true && r.json.ajoutes === 2 && appelsActualiser === 1);
      r = await requete(port, 'POST', '/admin/api/actualiser', { cookie, csrf, corps: {} });
      ok('routes : deux actualisations à moins de 10 s d\x27intervalle → une seule relève (plusieurs onglets ouverts)', r.code === 200 && r.json.ajoutes === 0 && appelsActualiser === 1);
      horloge += 11000; panneActualiser = true;
      r = await requete(port, 'POST', '/admin/api/actualiser', { cookie, csrf, corps: {} });
      ok('routes : une relève en échec (boîte injoignable) répond ok:false sans casser la page', r.code === 200 && r.json.ok === false && /refusé/.test(r.json.erreur) && appelsActualiser === 2);
      panneActualiser = false;

      // Nouveau message à une adresse (outil « Nouveau message » : popup de l'administration)
      const avantNouveau = envois.length;
      r = await requete(port, 'POST', '/admin/api/messages', { cookie, corps: { a: 'nouveau.contact@exemple.fr', objet: 'Votre site vitrine', texte: 'Bonjour,' } });
      ok("routes : nouveau message sans X-CSRF → 403 et rien n'est envoyé", r.code === 403 && envois.length === avantNouveau);
      let refusOk = true;
      for (const mauvais of [{ a: 'pas une adresse', objet: 'x', texte: 'x' }, { a: 'a@exemple.fr', objet: '   ', texte: 'x' }, { a: 'a@exemple.fr', objet: 'x', texte: '  ' }, { a: 'a@exemple.fr', objet: 'x'.repeat(301), texte: 'x' }]) {
        r = await requete(port, 'POST', '/admin/api/messages', { cookie, csrf, corps: mauvais });
        if (r.code !== 400) refusOk = false;
      }
      ok('routes : nouveau message sans adresse valide, sans objet, sans texte ou avec un objet de plus de 300 caractères → 400', refusOk && envois.length === avantNouveau);
      r = await requete(port, 'POST', '/admin/api/messages', { cookie, csrf, corps: { a: ' Nouveau.Contact@Exemple.FR ', objet: 'Votre site vitrine', texte: 'Bonjour,\nVoici ma proposition.', pieces: [{ nom: 'devis.pdf', typeMime: 'application/pdf', base64: Buffer.from('%PDF').toString('base64') }] } });
      const envoiNouveau = envois[envois.length - 1];
      ok("routes : nouveau message → envoyé à l'adresse saisie (normalisée), objet exact sans « Re: », hors fil de discussion, gabarit HTML, pièce jointe", r.code === 200 && r.json.ok === true && envois.length === avantNouveau + 1 && envoiNouveau.a === 'nouveau.contact@exemple.fr' && envoiNouveau.sujet === 'Votre site vitrine' && !envoiNouveau.enReponseA && /STUDIO <span/.test(envoiNouveau.html) && envoiNouveau.pieces.length === 1);
      const nouvelle = await cv.lireConversation(c, r.json.conversationId);
      ok('routes : nouveau message → conversation créée pour cette adresse avec le message sortant enregistré (objet, statut envoyé, pièce jointe)', nouvelle && nouvelle.utilisateur.email === 'nouveau.contact@exemple.fr' && nouvelle.messages.length === 1 && nouvelle.messages[0].sens === 'sortant' && nouvelle.messages[0].objet === 'Votre site vitrine' && nouvelle.messages[0].statutEnvoi === 'envoye' && nouvelle.messages[0].piecesJointes.length === 1);
      const idNouvelle = r.json.conversationId;
      r = await requete(port, 'POST', '/admin/api/messages', { cookie, csrf, corps: { a: 'nouveau.contact@exemple.fr', objet: 'Suite', texte: 'Un second message.' } });
      const suite = await cv.lireConversation(c, idNouvelle);
      ok('routes : second message à la même adresse → même conversation, message ajouté', r.json.conversationId === idNouvelle && suite.messages.length === 2);
      await cv.archiver(c, idNouvelle, true);
      await requete(port, 'POST', '/admin/api/messages', { cookie, csrf, corps: { a: 'nouveau.contact@exemple.fr', objet: 'Relance', texte: 'Bonjour à nouveau.' } });
      ok('routes : écrire à une adresse archivée la fait réapparaître dans la liste', !!(await requete(port, 'GET', '/admin/api/conversations', { cookie })).json.conversations.find((x) => x.id === idNouvelle));
      panneSmtp = true;
      r = await requete(port, 'POST', '/admin/api/messages', { cookie, csrf, corps: { a: 'echec.envoi@exemple.fr', objet: 'Objet du message', texte: 'Texte' } });
      const enEchec = await cv.lireConversation(c, r.json.conversationId);
      ok("routes : échec SMTP d'un nouveau message → conversation créée, message en échec, réponse ok:false avec l'identifiant de la conversation", r.code === 200 && r.json.ok === false && enEchec.messages[0].statutEnvoi === 'echec');
      panneSmtp = false;
      await requete(port, 'POST', '/admin/api/conversations/' + r.json.conversationId + '/renvoyer/' + enEchec.messages[0].id, { cookie, csrf, corps: {} });
      ok("routes : renvoyer un nouveau message garde son objet d'origine (aucun « Re: » ajouté)", envois[envois.length - 1].sujet === 'Objet du message');

      // Archivage
      r = await requete(port, 'POST', `/admin/api/conversations/${conversationId}/archiver`, { cookie, csrf, corps: { valeur: true } });
      const liste = await requete(port, 'GET', '/admin/api/conversations', { cookie });
      ok('routes : archiver retire la conversation de la liste', r.code === 200 && !liste.json.conversations.some((x) => x.id === conversationId));

      // Conversation inconnue, identifiant invalide
      r = await requete(port, 'GET', '/admin/api/conversations/999999999', { cookie });
      const r2 = await requete(port, 'GET', '/admin/api/conversations/abc', { cookie });
      ok('routes : conversation inconnue → 404, identifiant invalide → 404', r.code === 404 && r2.code === 404);

      // Perte du statut admin
      await c.query('UPDATE utilisateur SET statut = "utilisateur" WHERE email = "admin.routes@exemple.fr"');
      r = await requete(port, 'GET', '/admin/api/conversations', { cookie });
      const avantRetrait = envois.length;
      const ecrire = await requete(port, 'POST', '/admin/api/messages', { cookie, csrf, corps: { a: 'x@exemple.fr', objet: 'x', texte: 'x' } });
      ok("routes : un utilisateur qui n'est plus admin perd l'accès immédiatement (lecture et nouveau message)", r.code === 401 && ecrire.code === 401 && envois.length === avantRetrait);

      // Déconnexion (le statut admin est rendu pour que la session soit à nouveau valide)
      await c.query('UPDATE utilisateur SET statut = "admin" WHERE email = "admin.routes@exemple.fr"');
      r = await requete(port, 'POST', '/admin/deconnexion', { cookie, csrf, corps: {} });
      ok('routes : déconnexion → cookie effacé', r.code === 200 && /Max-Age=0/.test(String((r.entetes['set-cookie'] || [])[0])));
    } finally { serveur.close(); }

    // Zone absente sans secret
    const sansSecret = http.createServer((req, res) => admin.traiter(req, res, { ...deps, secret: '' }));
    await new Promise((rr) => sansSecret.listen(0, '127.0.0.1', rr));
    const p2 = sansSecret.address().port;
    const a1 = await requete(p2, 'GET', '/admin/api/conversations');
    const a2 = await requete(p2, 'POST', '/admin/connexion', { corps: { email: 'x@y.fr', mdp: 'x' } });
    const a3 = await requete(p2, 'GET', '/admin/');
    ok('routes : SESSION_SECRET absent → 404 partout', a1.code === 404 && a2.code === 404 && a3.code === 404);
    sansSecret.close();
  });
}

principal().then(() => (base.estConfiguree() ? testerRoutes() : null)).finally(() => (base.estConfiguree() ? base.pool().end() : null)).then(() => { console.log(echecs ? `\n✗ ${echecs} échec(s)` : '\n✓ administration conforme'); process.exit(echecs ? 1 : 0); },
  (e) => { console.error('Erreur :', e); process.exit(1); });
