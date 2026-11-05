// Serveur Node de Studio Novae, sans dépendance. Les pages sont générées en mémoire (src/), au démarrage puis
// toutes les 24 h en arrière-plan ; public_html/assets/ contient uniquement les fichiers (css, js, images).
// Variables : PORT (défaut 10000), NOINDEX ("0" pour la production, sinon l'aperçu n'est pas indexé).
require('./src/env').chargerTout(); // réglages de .env.local puis .env (jamais versionnés) avant de lire process.env
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const rendu = require('./src/rendu');
const apiContact = require('./src/api-contact');
const admin = require('./src/admin');

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

// Compression Brotli ou gzip des fichiers texte, gardée en mémoire (clé : contenu + encodage).
const COMPRESSIBLES = /^(text\/|application\/(json|xml|javascript)|image\/svg)/;
const cacheCompression = new Map();
function compresser(req, type, corps, cle) {
  const accepte = String(req.headers['accept-encoding'] || '');
  const encodage = /(^|[ ,])br([ ,;]|$)/.test(accepte) ? 'br' : /gzip/.test(accepte) ? 'gzip' : null;
  if (!encodage || !COMPRESSIBLES.test(type) || corps.length < 1024) return { corps, encodage: null };
  const k = `${encodage}|${cle}`;
  if (!cacheCompression.has(k)) {
    const tampon = Buffer.from(corps);
    cacheCompression.set(k, encodage === 'br'
      ? zlib.brotliCompressSync(tampon, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } })
      : zlib.gzipSync(tampon, { level: 9 }));
    if (cacheCompression.size > 200) cacheCompression.delete(cacheCompression.keys().next().value);
  }
  return { corps: cacheCompression.get(k), encodage };
}

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
  // Seule route qui accepte POST : le formulaire de la page Contact
  if (String(req.url).split('?')[0] === '/api/contact') return apiContact.traiter(req, res);
  // Administration (connexion requise, absente sans SESSION_SECRET)
  if (/^\/admin(\/|$|\?)/.test(String(req.url))) return admin.traiter(req, res);

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
    const { corps, encodage } = compresser(req, generee.type, generee.corps, `${chemin}|${generee.corps.length}`);
    entetes.Vary = 'Accept-Encoding';
    if (encodage) entetes['Content-Encoding'] = encodage;
    res.writeHead(200, entetes);
    return res.end(req.method === 'HEAD' ? '' : corps);
  }

  // Fichiers : uniquement sous /assets/
  if (!chemin.startsWith('/assets/')) return envoyer(res, 404, 'Page introuvable', { 'Content-Type': 'text/plain; charset=utf-8' });
  const relatif = chemin.replace(/^\/+/, '');
  const cible = resoudre(SITE, relatif);
  const fichier = cible && fichierSimple(cible);
  if (!fichier) return envoyer(res, 404, 'Page introuvable', { 'Content-Type': 'text/plain; charset=utf-8' });

  const ext = path.extname(fichier).toLowerCase();
  const type = TYPES[ext] || 'application/octet-stream';
  // Images et polices : 30 jours ; css et js : 1 jour (les noms de fichiers ne changent pas à chaque version).
  const entetes = { 'Content-Type': type, 'Cache-Control': /^\.(css|js)$/.test(ext) ? 'public, max-age=86400' : 'public, max-age=2592000', Vary: 'Accept-Encoding' };
  if (req.method === 'HEAD') return envoyer(res, 200, '', entetes);
  if (NOINDEX) entetes['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
  entetes['X-Content-Type-Options'] = 'nosniff';
  if (COMPRESSIBLES.test(type)) {
    let stat, texte;
    try { stat = fs.statSync(fichier); texte = fs.readFileSync(fichier); } catch { return res.destroy(); }
    const { corps, encodage } = compresser(req, type, texte, `${fichier}|${stat.mtimeMs}`);
    if (encodage) entetes['Content-Encoding'] = encodage;
    res.writeHead(200, entetes);
    return res.end(corps);
  }
  res.writeHead(200, entetes);
  fs.createReadStream(fichier).on('error', () => res.destroy()).pipe(res);
});

console.log(`${rendu.demarrer()} pages générées`);
serveur.listen(PORT, () => console.log(`Studio Novae : http://localhost:${PORT} (indexation ${NOINDEX ? 'bloquée' : 'autorisée'})`));
