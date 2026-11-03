// Serveur Node de Studio Novae, sans dépendance. Les pages sont générées en mémoire (src/), au démarrage puis
// toutes les 24 h en arrière-plan ; public_html/assets/ contient uniquement les fichiers (css, js, images).
// Variables : PORT (défaut 10000), NOINDEX ("0" pour la production, sinon l'aperçu n'est pas indexé).
const http = require('http');
const fs = require('fs');
const path = require('path');
const rendu = require('./src/rendu');

const PORT = Number(process.env.PORT) || 10000;
const NOINDEX = process.env.NOINDEX !== '0';
const SITE = path.join(__dirname, 'public_html');

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

function fichierSimple(fichier) {
  try { return fs.statSync(fichier).isFile() ? fichier : null; } catch { return null; }
}

const serveur = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return envoyer(res, 405, 'Méthode non autorisée', { Allow: 'GET, HEAD' });
  }

  let chemin;
  try { chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return envoyer(res, 400, 'Adresse invalide'); }
  if (chemin.includes('\0')) return envoyer(res, 400, 'Adresse invalide');

  // Une seule adresse pour le site : www.studionovae.org redirige vers studionovae.org
  const hote = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (/^www\.studionovae\.org(:\d+)?$/i.test(hote)) return envoyer(res, 301, '', { Location: 'https://studionovae.org' + req.url });

  // L'accueil n'a qu'une adresse : /index.html redirige vers /
  if (chemin === '/index.html') return envoyer(res, 301, '', { Location: '/' });

  const ancienne = chemin.match(ANCIENNES);
  if (ancienne) return envoyer(res, 301, '', { Location: `/services/${ancienne[1]}.html` });

  // Pages générées (accueil, services, aides, plan du site, robots.txt)
  const generee = rendu.pages().get(chemin);
  if (generee) {
    const entetes = { 'Content-Type': generee.type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    if (NOINDEX) entetes['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
    res.writeHead(200, entetes);
    return res.end(req.method === 'HEAD' ? '' : generee.corps);
  }

  // Fichiers : uniquement sous /assets/
  if (!chemin.startsWith('/assets/')) return envoyer(res, 404, 'Page introuvable', { 'Content-Type': 'text/plain; charset=utf-8' });
  const relatif = chemin.replace(/^\/+/, '');
  const cible = resoudre(SITE, relatif);
  const fichier = cible && fichierSimple(cible);
  if (!fichier) return envoyer(res, 404, 'Page introuvable', { 'Content-Type': 'text/plain; charset=utf-8' });

  const ext = path.extname(fichier).toLowerCase();
  const entetes = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=3600',
  };
  if (req.method === 'HEAD') return envoyer(res, 200, '', entetes);
  if (NOINDEX) entetes['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
  entetes['X-Content-Type-Options'] = 'nosniff';
  res.writeHead(200, entetes);
  fs.createReadStream(fichier).on('error', () => res.destroy()).pipe(res);
});

console.log(`${rendu.demarrer()} pages générées`);
serveur.listen(PORT, () => console.log(`Studio Novae : http://localhost:${PORT} (indexation ${NOINDEX ? 'bloquée' : 'autorisée'})`));
