// Construit le dossier dist/ servi par server.js : le site (public_html/ : pages, assets/css, assets/js, assets/images).
const fs = require('fs');
const path = require('path');

const racine = __dirname;
const dist = path.join(racine, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(path.join(racine, 'public_html'), dist, { recursive: true });

const fichiers = (dossier) => fs.readdirSync(dossier, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? fichiers(path.join(dossier, e.name)) : 1), 0);
console.log(`Build terminé : ${fichiers(dist)} fichiers dans dist/`);
