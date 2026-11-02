// Construit le dossier dist/ servi par server.js : le site (v4/) et ses images (assets/).
const fs = require('fs');
const path = require('path');

const racine = __dirname;
const dist = path.join(racine, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(path.join(racine, 'v4'), dist, { recursive: true });
fs.cpSync(path.join(racine, 'assets'), path.join(dist, 'assets'), { recursive: true });

const fichiers = (dossier) => fs.readdirSync(dossier, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? fichiers(path.join(dossier, e.name)) : 1), 0);
console.log(`Build terminé : ${fichiers(dist)} fichiers dans dist/`);
