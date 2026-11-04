// Construit toutes les pages en mémoire, comme le « revalidate = 86400 » de producteurslocaux.org :
// pages construites au démarrage, servies depuis la mémoire, puis reconstruites en arrière-plan
// lorsqu'elles ont plus de 24 h (la version en cache reste servie pendant la reconstruction).
const path = require('path');
const { DOMAINE } = require('./site');

const DUREE_MS = 24 * 60 * 60 * 1000;

// Recharge tous les modules de src/ pour que la reconstruction relise le code et les données.
function recharger() {
  const dossier = __dirname + path.sep;
  for (const cle of Object.keys(require.cache)) {
    if (cle.startsWith(dossier) && cle !== __filename) delete require.cache[cle];
  }
}

function construire() {
  recharger();
  const { pageAccueil } = require('./pages/accueil');
  const { pageContact, URL_CONTACT } = require('./pages/contact');
  const { pagesContenu } = require('./pages/contenu');
  const { pagesAides } = require('./aides/pages');

  const pages = new Map();
  const ajouter = (url, corps, type) => {
    if (pages.has(url)) throw new Error(`Adresse en double : ${url}`);
    pages.set(url, { corps, type });
  };
  ajouter('/', pageAccueil(), 'text/html; charset=utf-8');
  ajouter(URL_CONTACT, pageContact(), 'text/html; charset=utf-8');
  for (const p of [...pagesContenu(), ...pagesAides()]) ajouter(p.url, p.html, 'text/html; charset=utf-8');

  const urls = [...pages.keys()];
  ajouter('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${DOMAINE}${u}</loc></url>\n`).join('')}</urlset>\n`, 'application/xml; charset=utf-8');
  ajouter('/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${DOMAINE}/sitemap.xml\n`, 'text/plain; charset=utf-8');
  return { pages, construitLe: Date.now() };
}

let etat = null;
let enCours = false;

function demarrer() {
  etat = construire();
  return etat.pages.size;
}

// Retourne la table des pages ; déclenche la reconstruction si elle a plus de 24 h.
function pages() {
  if (!etat) demarrer();
  // Mode développement (RECHARGER=1, raccourci local) : pages reconstruites à chaque chargement.
  if (process.env.RECHARGER === '1') { etat = construire(); return etat.pages; }
  if (Date.now() - etat.construitLe > DUREE_MS && !enCours) {
    enCours = true;
    setImmediate(() => {
      try { etat = construire(); console.log('Pages reconstruites (24 h écoulées).'); }
      catch (e) { console.error('Reconstruction impossible, version précédente conservée :', e.message); etat.construitLe = Date.now() - DUREE_MS + 5 * 60 * 1000; }
      finally { enCours = false; }
    });
  }
  return etat.pages;
}

module.exports = { demarrer, pages, construire, DUREE_MS };
