// Enregistrement des demandes de la page Contact dans la base MySQL (pilote mysql2). Réglages par variables d'environnement
// (fichier .env, voir .env.example) : DB_HOST (défaut localhost), DB_PORT (3306), DB_NAME, DB_USER, DB_PASS.
// Sans DB_NAME, DB_USER et DB_PASS, la base est désactivée : les demandes restent dans le fichier demandes.jsonl et partent par e-mail.
// La table est créée toute seule au premier envoi (CREATE TABLE IF NOT EXISTS).
const SQL_TABLE = `CREATE TABLE IF NOT EXISTS demandes (
  id VARCHAR(16) NOT NULL PRIMARY KEY,
  recue_le DATETIME NOT NULL,
  type VARCHAR(10) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  mail VARCHAR(200) NOT NULL,
  tel VARCHAR(40) NULL,
  services VARCHAR(400) NULL,
  besoin TEXT NULL,
  delai VARCHAR(40) NULL,
  aide TINYINT(1) NOT NULL DEFAULT 0,
  message TEXT NULL,
  ip VARCHAR(64) NULL,
  courriel VARCHAR(10) NULL,
  courriel_erreur VARCHAR(300) NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

const SQL_INSERT = 'INSERT INTO demandes (id, recue_le, type, nom, mail, tel, services, besoin, delai, aide, message, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const SQL_STATUT = 'UPDATE demandes SET courriel = ?, courriel_erreur = ? WHERE id = ?';

const configuration = (env = process.env) => ({
  host: env.DB_HOST || 'localhost',
  port: Number(env.DB_PORT) || 3306,
  database: env.DB_NAME || '',
  user: env.DB_USER || '',
  password: env.DB_PASS || '',
});
const estConfiguree = (cfg = configuration()) => Boolean(cfg.database && cfg.user && cfg.password);

let reserve = null;      // pool de connexions (créé au premier envoi)
let tablePrete = null;   // promesse de création de la table
let fabrique = null;     // remplaçable dans les tests : () => pool

function pool() {
  if (!reserve) {
    reserve = fabrique ? fabrique() : require('mysql2/promise').createPool({ ...configuration(), connectionLimit: 3, charset: 'utf8mb4', connectTimeout: 10000, waitForConnections: true });
  }
  return reserve;
}

function preparer() {
  if (!tablePrete) tablePrete = pool().query(SQL_TABLE).catch((e) => { tablePrete = null; throw e; });
  return tablePrete;
}

// Insère la demande (ligne telle qu'enregistrée dans le fichier : id, recueLe, ip, type, champs du formulaire).
async function inserer(l) {
  await preparer();
  await pool().execute(SQL_INSERT, [
    l.id, new Date(l.recueLe), l.type, l.nom, l.mail,
    l.tel || null, l.services ? l.services.join(', ') : null, l.besoin || null, l.delai || null, l.aide ? 1 : 0, l.message || null, l.ip || null,
  ]);
}

// Note le résultat de l'envoi de l'e-mail sur la demande (« envoye » ou « echec »).
async function noterCourriel(id, etat, erreur) {
  await preparer();
  await pool().execute(SQL_STATUT, [etat, erreur ? String(erreur).slice(0, 300) : null, id]);
}

module.exports = { inserer, noterCourriel, estConfiguree, configuration, SQL_TABLE, SQL_INSERT, SQL_STATUT, _remplacerPilote: (f) => { fabrique = f; reserve = null; tablePrete = null; } };
