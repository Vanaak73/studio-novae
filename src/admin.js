// Routes de l'administration (/admin/*), réservées au statut admin. La zone est absente (404) tant que SESSION_SECRET (32 caractères minimum)
// et la base ne sont pas configurés. Toutes les réponses : Cache-Control no-store, X-Robots-Tag noindex.
// Les POST exigent un contenu JSON et l'en-tête X-CSRF (jeton de la session) ; seule la connexion en est dispensée.
const fs = require('fs');
const crypto = require('crypto');
const base = require('./base');
const session = require('./session');
const conversations = require('./conversations');
const pieces = require('./pieces');
const { normaliserEmail } = require('./utilisateurs');
const courriel = require('./courriel');
const { pageAdmin } = require('./pages/admin');

const CORPS_MAX = 14.5 * 1024 * 1024; // 10 Mo de pièces jointes en base64, plus le texte
const CORPS_CONNEXION_MAX = 4096; // la connexion n'attend que deux petits champs
const PAUSE_ACTUALISATION_MS = 10000; // deux actualisations plus rapprochées (plusieurs onglets) ne font qu'une relève
const TEXTE_MAX = 20000;
const OBJET_MAX = 300;
const PIECES_MAX = 5;
const ENTETES_BASE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };
const COOKIE_ATTRIBUTS = 'HttpOnly; Secure; SameSite=Strict; Path=/admin';

function reponse(res, code, corps, entetes = {}) {
  const json = corps !== null && typeof corps === 'object' && !Buffer.isBuffer(corps);
  res.writeHead(code, { ...ENTETES_BASE, 'Content-Type': json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', ...entetes });
  res.end(json ? JSON.stringify(corps) : String(corps));
}

// Lit un corps JSON (14,5 Mo au plus). Renvoie l'objet, ou null après avoir répondu lui-même (415, 413, 400).
function lireJson(req, res, max = CORPS_MAX) {
  return new Promise((resolve) => {
    if (!/^application\/json/i.test(String(req.headers['content-type'] || ''))) { reponse(res, 415, { ok: false, erreur: 'Contenu JSON attendu.' }); return resolve(null); }
    let taille = 0;
    const morceaux = [];
    req.on('data', (c) => {
      taille += c.length;
      if (taille > max) { reponse(res, 413, { ok: false, erreur: 'Envoi trop volumineux.' }); req.destroy(); return resolve(null); }
      morceaux.push(c);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      try { const o = JSON.parse(Buffer.concat(morceaux).toString('utf8') || '{}'); resolve(o && typeof o === 'object' ? o : {}); }
      catch { reponse(res, 400, { ok: false, erreur: 'Demande invalide.' }); resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

const egal = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const adresseIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const identifiant = (t) => (/^\d{1,10}$/.test(t) ? Number(t) : null);

async function utilisateurConnecte(req, d) {
  const s = session.lireSession(req.headers.cookie, d.secret);
  if (!s) return null;
  const [l] = await d.db.query('SELECT statut FROM utilisateur WHERE id = ?', [s.utilisateurId]);
  return l[0] && l[0].statut === 'admin' ? s : null;
}

// Envoie une réponse déjà enregistrée (message en attente) et note le résultat. Renvoie { ok, message }.
// sujet : objet du mail (par défaut « Re: … » d'après la conversation) ; fil = false pour un nouveau message (aucun lien avec les messages précédents).
async function expedier(d, conv, messageId, texte, piecesJointes, { sujet, fil = true } = {}) {
  const ctx = await conversations.contexteReponse(d.db, conv.conversation.id);
  try {
    const envoi = await d.envoyerCourriel({ a: conv.utilisateur.email, sujet: sujet || ctx.sujet, ...courriel.reponseClient(texte), enReponseA: fil ? ctx.enReponseA || undefined : undefined, references: fil ? ctx.references : undefined, pieces: piecesJointes });
    await conversations.majEnvoi(d.db, messageId, { statutEnvoi: 'envoye', messageIdEmail: envoi.messageId, envoyeLe: new Date() });
    try { await d.copierEnvoyes(envoi.brut); } catch (e) { console.error('Administration : copie dans « Envoyés » impossible :', e.message); }
    return { ok: true, message: { id: messageId, statutEnvoi: 'envoye' } };
  } catch (e) {
    await conversations.majEnvoi(d.db, messageId, { statutEnvoi: 'echec', erreur: e.message });
    return { ok: false, message: { id: messageId, statutEnvoi: 'echec', erreur: String(e.message).slice(0, 300) } };
  }
}

// Enregistre le message sortant (en attente) avec ses pièces jointes, puis l'envoie. Renvoie { ok, message }.
async function enregistrerEtExpedier(d, conv, { texte, objet, jointes, fil }) {
  const { id: messageId } = await conversations.ajouterMessage(d.db, conv.conversation.id, { sens: 'sortant', nature: 'email', objet, corps: texte, envoyeLe: new Date(), lu: true, statutEnvoi: 'en_attente' });
  const maintenant = new Date();
  for (const p of jointes) {
    const rangee = pieces.ecrirePiece(d.dossierPieces, maintenant, p.nom, p.contenu);
    await conversations.ajouterPieceJointe(d.db, messageId, { nom: rangee.nom, typeMime: p.typeMime, taille: p.contenu.length, chemin: rangee.chemin });
  }
  return expedier(d, conv, messageId, texte, jointes.map((p) => ({ ...p, nom: pieces.nomFichierSur(p.nom) })), { sujet: objet, fil });
}

function piecesDepuisCorps(brut, res) {
  const liste = Array.isArray(brut) ? brut : [];
  if (liste.length > PIECES_MAX) { reponse(res, 400, { ok: false, erreur: `${PIECES_MAX} pièces jointes au plus.` }); return null; }
  const decodees = [];
  let total = 0;
  for (const p of liste) {
    if (!p || typeof p.nom !== 'string' || typeof p.base64 !== 'string') { reponse(res, 400, { ok: false, erreur: 'Pièce jointe invalide.' }); return null; }
    const contenu = Buffer.from(p.base64, 'base64');
    total += contenu.length;
    if (total > pieces.TAILLE_MAX) { reponse(res, 413, { ok: false, erreur: 'Pièces jointes trop volumineuses (10 Mo au plus).' }); return null; }
    decodees.push({ nom: p.nom, typeMime: typeof p.typeMime === 'string' ? p.typeMime : 'application/octet-stream', contenu });
  }
  return decodees;
}

// Relève de la boîte à la demande (appelée par la page d'administration à l'ouverture, puis régulièrement tant qu'elle reste ouverte).
let preparateur = null;
let derniereActualisation = 0;
async function actualiserBoite() {
  const boite = require('./boite');
  const releve = require('./releve');
  if (!boite.estConfiguree()) return { ajoutes: 0 };
  const cfg = boite.configuration();
  preparateur = preparateur || releve.creerPreparateur(base.pool());
  return releve.passer({ db: base.pool(), preparer: preparateur, adresseBoite: cfg.user, lireNouveaux: (uid, validite) => boite.lireNouveaux(cfg, uid, validite) });
}

async function traiter(req, res, deps = {}) {
  const d = {
    db: deps.db || (base.estConfiguree() ? base.pool() : null),
    secret: deps.secret !== undefined ? deps.secret : process.env.SESSION_SECRET,
    dossierPieces: deps.dossierPieces || pieces.dossierParDefaut(),
    limiteur: deps.limiteur || session.limiteurParDefaut,
    envoyerCourriel: deps.envoyerCourriel || ((opts) => courriel.envoyer(opts)),
    maintenant: deps.maintenant || Date.now,
    actualiser: deps.actualiser || actualiserBoite,
    copierEnvoyes: deps.copierEnvoyes || ((brut) => require('./boite').copierEnvoyes(require('./boite').configuration(), brut)),
  };
  if (!d.db || typeof d.secret !== 'string' || d.secret.length < 32) return reponse(res, 404, 'Page introuvable');
  try {
    const chemin = String(req.url).split('?')[0].replace(/\/+$/, '') || '/';
    const requete = new URL(req.url, 'http://localhost').searchParams;

    if (chemin === '/admin/connexion' && req.method === 'POST') {
      const corps = await lireJson(req, res, CORPS_CONNEXION_MAX);
      if (!corps) return;
      const r = await session.connecter(d.db, corps.email, corps.mdp, adresseIp(req), d.secret, { limiteur: d.limiteur });
      if (r.erreur) return reponse(res, 401, { ok: false, erreur: r.erreur });
      return reponse(res, 200, { ok: true, csrf: r.csrf }, { 'Set-Cookie': `${session.NOM_COOKIE}=${r.cookie}; ${COOKIE_ATTRIBUTS}; Max-Age=${session.DUREE_MS / 1000}` });
    }

    const connecte = await utilisateurConnecte(req, d);

    // Page : formulaire de connexion sans session, conversations avec session
    if (chemin === '/admin' && (req.method === 'GET' || req.method === 'HEAD')) {
      let email = '';
      if (connecte) { const [l] = await d.db.query('SELECT email FROM utilisateur WHERE id = ?', [connecte.utilisateurId]); email = l[0] ? l[0].email : ''; }
      return reponse(res, 200, pageAdmin({ connecte: !!connecte, csrf: connecte ? connecte.csrf : '', email }), { 'Content-Type': 'text/html; charset=utf-8' });
    }

    if (!connecte) return reponse(res, 401, { ok: false, erreur: 'Connexion requise.' });

    if (req.method === 'POST') {
      if (!egal(req.headers['x-csrf'] || '', connecte.csrf)) return reponse(res, 403, { ok: false, erreur: 'Jeton de sécurité invalide.' });
    } else if (req.method !== 'GET') {
      return reponse(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
    }

    if (chemin === '/admin/api/actualiser' && req.method === 'POST') {
      const maintenant = d.maintenant();
      if (maintenant - derniereActualisation < PAUSE_ACTUALISATION_MS) return reponse(res, 200, { ok: true, ajoutes: 0 });
      derniereActualisation = maintenant;
      try { const r = await d.actualiser(); return reponse(res, 200, { ok: true, ajoutes: r.ajoutes || 0 }); }
      catch (e) { console.error('Administration : relève de la boîte en échec :', e.message); return reponse(res, 200, { ok: false, erreur: String(e.message).slice(0, 200) }); }
    }

    if (chemin === '/admin/deconnexion' && req.method === 'POST') {
      return reponse(res, 200, { ok: true }, { 'Set-Cookie': `${session.NOM_COOKIE}=; ${COOKIE_ATTRIBUTS}; Max-Age=0` });
    }

    if (chemin === '/admin/api/conversations' && req.method === 'GET') {
      const filtre = ['non_lues', 'devis'].includes(requete.get('filtre')) ? requete.get('filtre') : 'toutes';
      return reponse(res, 200, { ok: true, conversations: await conversations.listerConversations(d.db, filtre, requete.get('archivees') === '1') });
    }

    // Nouveau message à une adresse qui n'a pas encore écrit : crée (ou retrouve) la conversation de cette adresse et envoie le mail.
    if (chemin === '/admin/api/messages' && req.method === 'POST') {
      const corps = await lireJson(req, res);
      if (!corps) return;
      const adresse = normaliserEmail(corps.a);
      if (!adresse) return reponse(res, 400, { ok: false, erreur: 'Indiquez une adresse e-mail valide.' });
      const objet = typeof corps.objet === 'string' ? corps.objet.replace(/[\r\n]+/g, ' ').trim() : '';
      if (!objet || objet.length > OBJET_MAX) return reponse(res, 400, { ok: false, erreur: `Indiquez un objet de ${OBJET_MAX} caractères au plus.` });
      const texte = typeof corps.texte === 'string' ? corps.texte.replace(/\r\n/g, '\n').trim() : '';
      if (!texte || texte.length > TEXTE_MAX) return reponse(res, 400, { ok: false, erreur: `Écrivez un message de ${TEXTE_MAX} caractères au plus.` });
      const jointes = piecesDepuisCorps(corps.pieces, res);
      if (!jointes) return;
      const { conversationId } = await conversations.ouvrirConversation(d.db, adresse);
      await conversations.archiver(d.db, conversationId, false); // une conversation archivée réapparaît dans la liste
      const conv = await conversations.lireConversation(d.db, conversationId);
      const resultat = await enregistrerEtExpedier(d, conv, { texte, objet, jointes, fil: false });
      return reponse(res, 200, { ...resultat, conversationId });
    }

    let m = chemin.match(/^\/admin\/api\/conversations\/([^/]+)(?:\/(reponse|archiver|renvoyer\/([^/]+)))?$/);
    if (m) {
      const id = identifiant(m[1]);
      const conv = id === null ? null : await conversations.lireConversation(d.db, id);
      if (!conv) return reponse(res, 404, { ok: false, erreur: 'Conversation introuvable.' });

      if (!m[2] && req.method === 'GET') {
        await conversations.marquerLu(d.db, id);
        const lue = await conversations.lireConversation(d.db, id);
        return reponse(res, 200, { ok: true, ...lue });
      }

      if (m[2] === 'archiver' && req.method === 'POST') {
        const corps = await lireJson(req, res);
        if (!corps) return;
        await conversations.archiver(d.db, id, corps.valeur !== false);
        return reponse(res, 200, { ok: true });
      }

      if (m[2] === 'reponse' && req.method === 'POST') {
        const corps = await lireJson(req, res);
        if (!corps) return;
        const texte = typeof corps.texte === 'string' ? corps.texte.replace(/\r\n/g, '\n').trim() : '';
        if (!texte || texte.length > TEXTE_MAX) return reponse(res, 400, { ok: false, erreur: `Écrivez un message de ${TEXTE_MAX} caractères au plus.` });
        const jointes = piecesDepuisCorps(corps.pieces, res);
        if (!jointes) return;
        const ctx = await conversations.contexteReponse(d.db, id);
        return reponse(res, 200, await enregistrerEtExpedier(d, conv, { texte, objet: ctx.sujet, jointes, fil: true }));
      }

      if (m[3] && req.method === 'POST') {
        const messageId = identifiant(m[3]);
        const message = messageId === null ? null : await conversations.lireMessage(d.db, messageId);
        if (!message || message.conversationId !== id || message.sens !== 'sortant' || message.statutEnvoi !== 'echec') return reponse(res, 404, { ok: false, erreur: 'Message introuvable.' });
        const jointes = [];
        for (const p of await conversations.piecesDuMessage(d.db, messageId)) {
          const fichier = pieces.cheminSur(d.dossierPieces, p.chemin);
          if (fichier && fs.existsSync(fichier)) jointes.push({ nom: p.nom, typeMime: p.typeMime || 'application/octet-stream', contenu: fs.readFileSync(fichier) });
        }
        return reponse(res, 200, await expedier(d, conv, messageId, message.corps, jointes, { sujet: message.objet || undefined }));
      }
    }

    m = chemin.match(/^\/admin\/pieces\/([^/]+)$/);
    if (m && req.method === 'GET') {
      const piece = identifiant(m[1]) === null ? null : await conversations.lirePieceJointe(d.db, identifiant(m[1]));
      const fichier = piece && pieces.cheminSur(d.dossierPieces, piece.chemin);
      if (!fichier || !fs.existsSync(fichier)) return reponse(res, 404, 'Pièce introuvable');
      const contenu = fs.readFileSync(fichier);
      return reponse(res, 200, contenu, {
        'Content-Type': /^[\w.+-]+\/[\w.+-]+$/.test(piece.typeMime || '') ? piece.typeMime : 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(piece.nom)}`,
        'Content-Length': String(contenu.length),
      });
    }

    return reponse(res, 404, { ok: false, erreur: 'Introuvable.' });
  } catch (e) {
    console.error('Administration :', e.message);
    if (!res.headersSent) reponse(res, 500, { ok: false, erreur: 'Erreur du serveur.' });
  }
}

module.exports = { traiter };
