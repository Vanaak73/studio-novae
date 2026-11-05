// Tables des utilisateurs, coordonnées, conversations, messages et pièces jointes (identiques à celles créées le 2026-11-05 dans la base Hostinger).
// preparerSchema(db) les crée si elles manquent (CREATE TABLE IF NOT EXISTS) : sans effet sur une base déjà à jour.
const T = ' ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS utilisateur (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, email VARCHAR(190) NOT NULL, mdp VARCHAR(255) NULL, statut ENUM("utilisateur","partenaire","admin") NOT NULL DEFAULT "utilisateur", cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_utilisateur_email (email))' + T,
  'CREATE TABLE IF NOT EXISTS coordonnee (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, utilisateur_id INT UNSIGNED NOT NULL, type VARCHAR(40) NOT NULL, valeur VARCHAR(500) NOT NULL, cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_coordonnee_utilisateur (utilisateur_id, type), CONSTRAINT fk_coordonnee_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE)' + T,
  'CREATE TABLE IF NOT EXISTS conversation (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, utilisateur_id INT UNSIGNED NOT NULL, archivee TINYINT(1) NOT NULL DEFAULT 0, dernier_message_le DATETIME NULL, cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_conversation_utilisateur (utilisateur_id), KEY idx_conversation_dernier (archivee, dernier_message_le), CONSTRAINT fk_conversation_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE)' + T,
  'CREATE TABLE IF NOT EXISTS message (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, conversation_id INT UNSIGNED NOT NULL, sens ENUM("entrant","sortant") NOT NULL, nature ENUM("email","demande") NOT NULL DEFAULT "email", demande_id VARCHAR(16) NULL, message_id_email VARCHAR(255) NULL, objet VARCHAR(300) NULL, corps MEDIUMTEXT NULL, envoye_le DATETIME NOT NULL, lu TINYINT(1) NOT NULL DEFAULT 0, statut_envoi ENUM("envoye","en_attente","echec") NOT NULL DEFAULT "envoye", erreur VARCHAR(300) NULL, auth_echec TINYINT(1) NOT NULL DEFAULT 0, cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_message_email (message_id_email), KEY idx_message_fil (conversation_id, envoye_le), CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversation(id) ON DELETE CASCADE)' + T,
  'CREATE TABLE IF NOT EXISTS piece_jointe (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, message_id INT UNSIGNED NOT NULL, nom VARCHAR(255) NOT NULL, type_mime VARCHAR(120) NULL, taille INT UNSIGNED NOT NULL DEFAULT 0, chemin VARCHAR(500) NOT NULL, KEY idx_pj_message (message_id), CONSTRAINT fk_pj_message FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE)' + T,
];

async function preparerSchema(db) {
  for (const sql of SCHEMA) await db.query(sql);
}

module.exports = { SCHEMA, preparerSchema };
