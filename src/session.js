// Sessions de l'administration : cookie signé (HMAC SHA-256) valable 8 h, jeton anti-CSRF, limitation des tentatives de connexion.
// Le secret (SESSION_SECRET, 32 caractères minimum) n'est jamais écrit dans le cookie. Aucun état gardé côté serveur : la session est dans le cookie.
const crypto = require('crypto');
const { trouverParEmail, verifierMotDePasse, hacherMotDePasse, normaliserEmail } = require('./utilisateurs');

const NOM_COOKIE = 'novae_session';
const DUREE_MS = 8 * 3600 * 1000;
const ECHECS_MAX = 5;
const BLOCAGE_MS = 15 * 60 * 1000;
const MESSAGE_ECHEC = 'Adresse ou mot de passe incorrect.';
const MESSAGE_BLOQUE = 'Trop de tentatives. Réessayez dans quelques minutes.';

const signer = (donnees, secret) => crypto.createHmac('sha256', secret).update(donnees).digest('base64url');

function verifierSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('SESSION_SECRET : 32 caractères minimum');
}

function creerSession(utilisateurId, secret, maintenant = Date.now()) {
  verifierSecret(secret);
  const csrf = crypto.randomBytes(24).toString('hex');
  const charge = Buffer.from(JSON.stringify({ u: utilisateurId, exp: maintenant + DUREE_MS, csrf })).toString('base64url');
  return { cookie: `${charge}.${signer(charge, secret)}`, csrf };
}

// Relit la session depuis l'en-tête Cookie ; null si elle est absente, falsifiée ou expirée.
function lireSession(enteteCookie, secret, maintenant = Date.now()) {
  if (typeof enteteCookie !== 'string' || typeof secret !== 'string' || secret.length < 32) return null;
  const morceau = enteteCookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(NOM_COOKIE + '='));
  if (!morceau) return null;
  const jeton = morceau.slice(NOM_COOKIE.length + 1);
  const [charge, signature] = jeton.split('.');
  if (!charge || !signature) return null;
  const attendue = Buffer.from(signer(charge, secret));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !crypto.timingSafeEqual(attendue, recue)) return null;
  try {
    const d = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'));
    if (!Number.isInteger(d.u) || typeof d.csrf !== 'string' || !(d.exp > maintenant)) return null;
    return { utilisateurId: d.u, csrf: d.csrf };
  } catch { return null; }
}

// Limitation des tentatives : 5 échecs → clé bloquée 15 min. Clés utilisées : « mail:<adresse> » et « ip:<adresse ip> ».
function creerLimiteur() {
  const etat = new Map();
  const frais = (cle, maintenant) => {
    const e = etat.get(cle);
    if (e && maintenant - e.dernier > BLOCAGE_MS) { etat.delete(cle); return null; }
    return e || null;
  };
  return {
    echec(cle, maintenant = Date.now()) {
      const e = frais(cle, maintenant) || { n: 0, dernier: maintenant };
      e.n++; e.dernier = maintenant;
      etat.set(cle, e);
      if (etat.size > 10000) etat.clear();
    },
    bloque(cle, maintenant = Date.now()) {
      const e = frais(cle, maintenant);
      return !!e && e.n >= ECHECS_MAX;
    },
    reussite(cle) { etat.delete(cle); },
  };
}
const limiteurParDefaut = creerLimiteur();
const FAUX_HASH = hacherMotDePasse('mot de passe factice pour égaliser les durées');

// Connexion d'un administrateur. Renvoie { cookie, csrf } ou { erreur } (même message pour une adresse inconnue, un mauvais mot de passe et un statut sans accès).
async function connecter(db, email, mdp, ip, secret, { limiteur = limiteurParDefaut, maintenant = Date.now() } = {}) {
  const adresse = normaliserEmail(email);
  const cles = [`mail:${adresse || String(email).slice(0, 100)}`, `ip:${ip}`];
  if (cles.some((k) => limiteur.bloque(k, maintenant))) return { erreur: MESSAGE_BLOQUE };
  const utilisateur = adresse ? await trouverParEmail(db, adresse) : null;
  const motDePasseBon = verifierMotDePasse(String(mdp || ''), utilisateur && utilisateur.mdp ? utilisateur.mdp : FAUX_HASH);
  if (!utilisateur || !utilisateur.mdp || utilisateur.statut !== 'admin' || !motDePasseBon) {
    cles.forEach((k) => limiteur.echec(k, maintenant));
    return { erreur: MESSAGE_ECHEC };
  }
  cles.forEach((k) => limiteur.reussite(k));
  return creerSession(utilisateur.id, secret, maintenant);
}

module.exports = { NOM_COOKIE, DUREE_MS, creerSession, lireSession, creerLimiteur, limiteurParDefaut, connecter };
