// Test de démarrage rapide, comme en production : démarre server.js, vérifie les adresses clés (pages, fichiers, redirections), puis l'arrête.
//   node scripts/test-demarrage.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const PORT = 4178;
const BASE = `http://localhost:${PORT}`;
const att = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const serveur = spawn(process.execPath, ['server.js'], { cwd: RACINE, env: { ...process.env, PORT: String(PORT), NOINDEX: '0' }, stdio: 'ignore' });
  let echecs = 0;
  const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? '✓' : '✗ ÉCHEC'}  ${nom}${detail ? '  → ' + detail : ''}`); };
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/')).ok) break; } catch (e) { /* pas prêt */ } await att(250); }
    const get = async (u) => { const r = await fetch(BASE + u, { redirect: 'manual' }); return { statut: r.status, texte: r.status === 200 ? await r.text() : '' }; };
    for (const u of ['/', '/a-propos', '/services/site-vitrine', '/services/video-ugc', '/aides-creation-digitale/', '/aides-creation-digitale/bretagne/', '/aides-creation-digitale/outre-mer/',
      '/assets/css/style.css', '/assets/css/aides.css', '/assets/js/site.js', '/assets/js/aides.js', '/assets/images/aides-echange.jpg', '/assets/images/montagnes-coucher-soleil.jpg', '/assets/images/realisations/logo-roofmonkeys.jpg', '/sitemap.xml', '/robots.txt']) {
      const r = await get(u); ok(`${u} répond 200`, r.statut === 200, r.statut);
    }
    ok('/index.html redirige vers /', (await get('/index.html')).statut === 301);
    // Cache : un fichier demandé avec son numéro de version (?v=…) se garde un an ; sans numéro, un jour
    const cache = async (u) => (await fetch(BASE + u)).headers.get('cache-control');
    const cacheVersionne = await cache('/assets/css/style.css?v=0a1b2c3d');
    ok('fichier CSS/JS avec ?v= : Cache-Control public, max-age=31536000, immutable', cacheVersionne === 'public, max-age=31536000, immutable', cacheVersionne);
    ok('fichier CSS/JS sans ?v= : Cache-Control public, max-age=86400 (inchangé)', (await cache('/assets/css/style.css')) === 'public, max-age=86400');
    ok('image avec ?v= ou sans : cache de 30 jours (inchangé)', (await cache('/assets/images/hero-oeil-numerique.webp')) === 'public, max-age=2592000');
    // Adresses visibles sans « .html » : les anciennes adresses redirigent (301) vers la nouvelle, requête conservée
    const lieu = async (u) => { const r = await fetch(BASE + u, { redirect: 'manual' }); return { statut: r.status, lieu: r.headers.get('location') }; };
    for (const [ancienne, nouvelle] of [['/a-propos.html', '/a-propos'], ['/contact.html', '/contact'], ['/services/site-vitrine.html', '/services/site-vitrine'], ['/services/video-ugc.html?x=1', '/services/video-ugc?x=1'], ['/contact.html?service=boutique-en-ligne', '/contact?service=boutique-en-ligne']]) {
      const r = await lieu(ancienne);
      ok(`${ancienne} redirige (301) vers ${nouvelle}`, r.statut === 301 && r.lieu === nouvelle, `${r.statut} ${r.lieu}`);
    }
    const tresAncienne = await lieu('/site-vitrine.html');
    ok('/site-vitrine.html (très ancienne adresse) redirige en une seule étape vers /services/site-vitrine', tresAncienne.statut === 301 && tresAncienne.lieu === '/services/site-vitrine', `${tresAncienne.statut} ${tresAncienne.lieu}`);
    ok('une page .html inexistante reste 404', (await get('/services/inconnu.html')).statut === 404 && (await get('/inconnu.html')).statut === 404);
    ok('les pages ne répondent que sous leur adresse sans .html', (await get('/contact')).statut === 200 && (await get('/a-propos')).statut === 200 && (await get('/services/video-ugc')).statut === 200);
    const pageAccueil = (await get('/')).texte;
    ok('aucun lien interne de l\'accueil ne contient « .html »', !/href="\/[^"]*\.html/.test(pageAccueil));
    const hote = async (h, u) => { const r = await fetch(BASE + u, { redirect: 'manual', headers: { 'x-forwarded-host': h } }); return { statut: r.status, lieu: r.headers.get('location') }; };
    const www = await hote('www.studionovae.org', '/a-propos?x=1');
    ok('www.studionovae.org redirige (301) vers studionovae.org', www.statut === 301 && www.lieu === 'https://studionovae.org/a-propos?x=1', www.lieu);
    ok('studionovae.org ne redirige pas', (await hote('studionovae.org', '/')).statut === 200);
    ok('le code source (src/) n\'est pas servi', (await get('/src/rendu.js')).statut === 404 && (await get('/assets/../src/rendu.js')).statut !== 200);
    ok('/style.css (ancien chemin) absent', (await get('/style.css')).statut === 404);
    ok('/assets/../server.js refusé', (await get('/assets/../server.js')).statut !== 200);
    const accueil = (await get('/')).texte, css = (await get('/assets/css/style.css')).texte, js = (await get('/assets/js/site.js')).texte, hub = (await get('/aides-creation-digitale/')).texte;
    ok('accueil : bouton « Demander un devis » dans l\'en-tête', accueil.includes('nav-devis'));
    ok('accueil : bande aides', accueil.includes('id="aides"'));
    ok('site.js : en-tête qui se cache et réapparaît', js.includes('majEntete') && js.includes('resynchroniserEntete') && js.includes('Math.max(0, finAccueil'));
    const reglage = js.match(/var ATTENTE = [^;]*;/);
    ok('site.js : le titre se déchiffre plus vite sur téléphone (650 px) que sur ordinateur', !!reglage && /matchMedia\('\(max-width: 650px\)'\)\.matches/.test(js) && /ATTENTE = tel \? 500 : 1000/.test(reglage[0]) && /PAR_LETTRE = tel \? 45 : 90/.test(reglage[0]) && /CLIGNOTE_ON = tel \? 440 : 880/.test(reglage[0]) && /CLIGNOTEMENTS_FIN = tel \? 2 : 5/.test(reglage[0]), reglage && reglage[0]);
    ok('site.js : sur téléphone seulement, aucun clignotement du curseur avant l\'apparition du texte (CLIGNOTEMENTS_DEBUT = tel ? 0 : 1)', !!reglage && /CLIGNOTEMENTS_DEBUT = tel \? 0 : 1\b/.test(reglage[0]), reglage && reglage[0]);
    ok('site.js : le déchiffrement mesure les lettres APRÈS le chargement de Space Grotesk (feuille Google Fonts puis document.fonts.load), avec un délai maximal', /attendrePolice/.test(js) && /fonts\.googleapis\.com/.test(js) && /document\.fonts\.load\('300 1em "Space Grotesk"'\)/.test(js) && /attendrePolice\(\)\.then\(lancerDc\)/.test(js));
    ok('site.js : l\'attente de la police cible la feuille de styles (/css2) et non le lien « preconnect » du même domaine (sinon 2,5 s d\'attente à chaque visite)', /querySelector\('link\[href\*="fonts\.googleapis\.com\/css2"\]'\)/.test(js));
    ok('style.css : états de l\'en-tête (cache, plein)', css.includes('.site-header.cache') && css.includes('.site-header.plein'));
    ok('hub : feuilles de style et scripts en /assets/', hub.includes('/assets/css/aides.css') && hub.includes('/assets/js/aides.js') && !hub.includes('href="/style.css"'));
    ok('adresse contact@studionovae.org partout, jamais bonjour@', accueil.includes('contact@studionovae.org') && !accueil.includes('bonjour@') && !hub.includes('bonjour@'));
  } finally { serveur.kill(); }
  console.log(echecs ? `\n✗ ${echecs} échec(s) : NE PAS POUSSER` : '\n✓ le site démarre et sert tout correctement depuis la nouvelle structure');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error('Le test a planté :', e.message); process.exit(2); });
