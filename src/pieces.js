// Stockage des pièces jointes sur le disque du serveur, hors du dossier servi au public (PIECES_DIR, défaut : data/pieces).
// Le chemin enregistré en base est relatif à ce dossier ; cheminSur() refuse tout chemin qui en sortirait.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TAILLE_MAX = 10 * 1024 * 1024; // par message (reçu ou envoyé)
const dossierParDefaut = () => process.env.PIECES_DIR || path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'pieces');

// Nom de fichier sans dossier ni caractère spécial, 100 caractères au plus.
const nomFichierSur = (nom) => (path.basename(String(nom).replace(/\\/g, '/')).replace(/[^\w.-]+/g, '_').replace(/^\.+/, '').slice(0, 100) || 'fichier');

// Écrit une pièce sous <dossier>/<année>/<mois>/<hasard>-<nom> ; renvoie { nom, chemin } (chemin relatif, séparateurs « / »).
function ecrirePiece(dossier, date, nom, contenu) {
  const propre = nomFichierSur(nom);
  const relatif = path.join(String(date.getUTCFullYear()), String(date.getUTCMonth() + 1).padStart(2, '0'), `${crypto.randomBytes(6).toString('hex')}-${propre}`);
  fs.mkdirSync(path.dirname(path.join(dossier, relatif)), { recursive: true });
  fs.writeFileSync(path.join(dossier, relatif), contenu);
  return { nom: propre, chemin: relatif.split(path.sep).join('/') };
}

// Chemin absolu d'une pièce, ou null si le chemin relatif sort du dossier de stockage.
function cheminSur(dossier, relatif) {
  const racine = path.resolve(dossier);
  const complet = path.resolve(racine, String(relatif));
  return complet.startsWith(racine + path.sep) ? complet : null;
}

module.exports = { TAILLE_MAX, dossierParDefaut, nomFichierSur, ecrirePiece, cheminSur };
