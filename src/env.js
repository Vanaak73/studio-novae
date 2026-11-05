// Charge le fichier .env à la racine du projet (lignes CLE=valeur, # pour les commentaires) dans process.env, sans dépendance.
// Une variable déjà définie (par l'hébergeur ou la ligne de commande) n'est jamais écrasée. Le fichier .env n'est pas versionné (.gitignore).
const fs = require('fs');
const path = require('path');

function analyser(texte) {
  const variables = {};
  for (const ligne of texte.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(ligne)) continue;
    const m = ligne.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let valeur = m[2];
    if (/^(["']).*\1$/.test(valeur)) valeur = valeur.slice(1, -1);
    variables[m[1]] = valeur;
  }
  return variables;
}

function charger(fichier = path.join(__dirname, '..', '.env')) {
  let texte;
  try { texte = fs.readFileSync(fichier, 'utf8'); } catch { return []; }
  const lues = [];
  for (const [cle, valeur] of Object.entries(analyser(texte))) {
    if (process.env[cle] === undefined) { process.env[cle] = valeur; lues.push(cle); }
  }
  return lues;
}

// .env.local (réglages propres à un poste, non versionné) est lu AVANT .env : ses variables l'emportent. Absent chez l'hébergeur.
function chargerTout() {
  const racine = path.join(__dirname, '..');
  return [...charger(path.join(racine, '.env.local')), ...charger(path.join(racine, '.env'))];
}

module.exports = { charger, chargerTout, analyser };
