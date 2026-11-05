// Utilisateurs : mots de passe hachés (scrypt, module crypto de Node), adresses normalisées, création à la volée d'un client sans compte.
// Toutes les fonctions SQL prennent en premier paramètre db (pool ou connexion mysql2).
const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const LONGUEUR = 64;

// Format enregistré : scrypt$<sel base64>$<hash base64>
function hacherMotDePasse(mdp) {
  const sel = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(mdp), sel, LONGUEUR, SCRYPT);
  return `scrypt$${sel.toString('base64')}$${hash.toString('base64')}`;
}

function verifierMotDePasse(mdp, enregistre) {
  if (typeof enregistre !== 'string' || !enregistre) return false;
  const [algo, sel, hash] = enregistre.split('$');
  if (algo !== 'scrypt' || !sel || !hash) return false;
  const attendu = Buffer.from(hash, 'base64');
  const calcule = crypto.scryptSync(String(mdp), Buffer.from(sel, 'base64'), attendu.length, SCRYPT);
  return crypto.timingSafeEqual(calcule, attendu);
}

// Extrait l'adresse de « "Nom" <a@b> » ou d'une adresse seule ; minuscules ; chaîne vide si aucune adresse valide.
function normaliserEmail(texte) {
  const brut = String(texte || '');
  const chevrons = brut.match(/<([^<>]+)>/);
  const candidate = (chevrons ? chevrons[1] : brut).trim().toLowerCase();
  return /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/.test(candidate) && candidate.length <= 190 ? candidate : '';
}

async function trouverParEmail(db, email) {
  const [lignes] = await db.query('SELECT id, email, mdp, statut FROM utilisateur WHERE email = ?', [normaliserEmail(email)]);
  return lignes[0] || null;
}

// Un client qui écrit est enregistré sans mot de passe (pas d'inscription). Sûr en concurrence : l'adresse est unique.
async function trouverOuCreer(db, email) {
  const adresse = normaliserEmail(email);
  if (!adresse) throw new Error('Adresse e-mail invalide');
  await db.query('INSERT INTO utilisateur (email) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)', [adresse]);
  const [lignes] = await db.query('SELECT id, email, statut FROM utilisateur WHERE email = ?', [adresse]);
  return lignes[0];
}

// Crée l'utilisateur s'il manque, définit son mot de passe et lui donne le statut admin.
async function creerAdmin(db, email, mdp) {
  const utilisateur = await trouverOuCreer(db, email);
  await db.query('UPDATE utilisateur SET mdp = ?, statut = "admin" WHERE id = ?', [hacherMotDePasse(mdp), utilisateur.id]);
  return utilisateur.id;
}

module.exports = { hacherMotDePasse, verifierMotDePasse, normaliserEmail, trouverParEmail, trouverOuCreer, creerAdmin };
