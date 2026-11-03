// Serveur Node de Studio Novae : sert le dossier public_html (pages, assets/css, assets/js, assets/images), sans dépendance.
// Variables : PORT (défaut 10000), NOINDEX ("0" pour la production, sinon l'aperçu n'est pas indexé).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 10000;
const NOINDEX = process.env.NOINDEX !== '0';
// Après `npm run build`, tout est servi depuis dist/ ; sans build, directement depuis public_html/.
const DIST = path.join(__dirname, 'dist');
const SITE = fs.existsSync(DIST) ? DIST : path.join(__dirname, 'public_html');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

// Anciennes adresses des pages services -> /services/
const ANCIENNES = /^\/(site-vitrine|outil-metier|boutique-en-ligne|automatisation-ia)\.html$/;

function envoyer(res, code, corps, entetes = {}) {
  if (NOINDEX) entetes['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
  entetes['X-Content-Type-Options'] = 'nosniff';
  res.writeHead(code, entetes);
  res.end(corps);
}

// Résout une URL vers un fichier du dossier de base, en refusant toute sortie de ce dossier.
function resoudre(base, relatif) {
  const fichier = path.normalize(path.join(base, relatif));
  if (fichier !== base && !fichier.startsWith(base + path.sep)) return null;
  return fichier;
}

function fichierOuIndex(fichier) {
  let stat;
  try { stat = fs.statSync(fichier); } catch { return null; }
  if (stat.isDirectory()) {
    const index = path.join(fichier, 'index.html');
    return fs.existsSync(index) ? index : null;
  }
  return fichier;
}

const serveur = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return envoyer(res, 405, 'Méthode non autorisée', { Allow: 'GET, HEAD' });
  }

  let chemin;
  try { chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return envoyer(res, 400, 'Adresse invalide'); }
  if (chemin.includes('\0')) return envoyer(res, 400, 'Adresse invalide');

  // L'accueil n'a qu'une adresse : /index.html redirige vers /
  if (chemin === '/index.html') return envoyer(res, 301, '', { Location: '/' });

  const ancienne = chemin.match(ANCIENNES);
  if (ancienne) return envoyer(res, 301, '', { Location: `/services/${ancienne[1]}.html` });

  const base = SITE;
  const relatif = chemin.replace(/^\/+/, '');
  const cible = resoudre(base, relatif);
  const fichier = cible && fichierOuIndex(cible);
  if (!fichier) return envoyer(res, 404, 'Page introuvable', { 'Content-Type': 'text/plain; charset=utf-8' });

  const ext = path.extname(fichier).toLowerCase();
  const entetes = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  };
  if (req.method === 'HEAD') return envoyer(res, 200, '', entetes);
  if (NOINDEX) entetes['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
  entetes['X-Content-Type-Options'] = 'nosniff';
  res.writeHead(200, entetes);
  fs.createReadStream(fichier).on('error', () => res.destroy()).pipe(res);
});

serveur.listen(PORT, () => console.log(`Studio Novae : http://localhost:${PORT} (indexation ${NOINDEX ? 'bloquée' : 'autorisée'})`));
