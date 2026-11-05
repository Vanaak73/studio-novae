// Version automatique des feuilles de style et des scripts : /assets/css/style.css devient /assets/css/style.css?v=<empreinte>.
// L'empreinte (8 caractères) vient du CONTENU du fichier : dès qu'un fichier change, son adresse change et les navigateurs le rechargent ;
// sans changement, ils gardent leur copie. Le serveur garde alors ces fichiers un an (server.js).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.join(__dirname, '..', 'public_html');
const CONCERNEES = /^\/assets\/(css|js)\/[\w.-]+\.(css|js)$/;
const memoire = new Map(); // chemin du fichier → { mtimeMs, taille, v } : l'empreinte n'est recalculée que si le fichier a changé

// Empreinte du contenu du fichier, ou '' s'il n'existe pas.
function version(url, racine = RACINE) {
  const fichier = path.join(racine, url);
  let stat;
  try { stat = fs.statSync(fichier); } catch { return ''; }
  const connu = memoire.get(fichier);
  if (connu && connu.mtimeMs === stat.mtimeMs && connu.taille === stat.size) return connu.v;
  const v = crypto.createHash('sha1').update(fs.readFileSync(fichier)).digest('hex').slice(0, 8);
  memoire.set(fichier, { mtimeMs: stat.mtimeMs, taille: stat.size, v });
  return v;
}

// Adresse d'un fichier CSS ou JS avec son numéro de version ; toute autre adresse (images, pages) est renvoyée telle quelle.
function asset(url, racine = RACINE) {
  if (!CONCERNEES.test(url)) return url;
  const v = version(url, racine);
  return v ? `${url}?v=${v}` : url;
}

module.exports = { asset, version };
