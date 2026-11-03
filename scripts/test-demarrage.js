// Test de démarrage rapide, comme en production : construit dist/, démarre server.js, vérifie les adresses clés, puis arrête et nettoie.
//   node scripts/test-demarrage.js
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const PORT = 4178;
const BASE = `http://localhost:${PORT}`;
const att = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  execFileSync(process.execPath, ['build.js'], { cwd: RACINE, stdio: 'inherit' });
  const serveur = spawn(process.execPath, ['server.js'], { cwd: RACINE, env: { ...process.env, PORT: String(PORT), NOINDEX: '0' }, stdio: 'ignore' });
  let echecs = 0;
  const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? '✓' : '✗ ÉCHEC'}  ${nom}${detail ? '  → ' + detail : ''}`); };
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/')).ok) break; } catch (e) { /* pas prêt */ } await att(250); }
    const get = async (u) => { const r = await fetch(BASE + u, { redirect: 'manual' }); return { statut: r.status, texte: r.status === 200 ? await r.text() : '' }; };
    for (const u of ['/', '/a-propos.html', '/services/site-vitrine.html', '/services/video-ugc.html', '/aide-creation-site-web/', '/aide-creation-site-web/bretagne/', '/aide-creation-site-web/outre-mer/',
      '/assets/css/style.css', '/assets/css/aides.css', '/assets/js/site.js', '/assets/js/aides.js', '/assets/images/aides-echange.jpg', '/assets/images/montagnes-coucher-soleil.jpg', '/assets/images/realisations/logo-roofmonkeys.jpg', '/sitemap.xml', '/robots.txt']) {
      const r = await get(u); ok(`${u} répond 200`, r.statut === 200, r.statut);
    }
    ok('/index.html redirige vers /', (await get('/index.html')).statut === 301);
    ok('/style.css (ancien chemin) absent', (await get('/style.css')).statut === 404);
    ok('/assets/../server.js refusé', (await get('/assets/../server.js')).statut !== 200);
    const accueil = (await get('/')).texte, css = (await get('/assets/css/style.css')).texte, js = (await get('/assets/js/site.js')).texte, hub = (await get('/aide-creation-site-web/')).texte;
    ok('accueil : bouton « Demander un devis » dans l\'en-tête', accueil.includes('nav-devis'));
    ok('accueil : bande aides', accueil.includes('id="aides"'));
    ok('site.js : en-tête qui se cache et réapparaît', js.includes('majEntete') && js.includes('resynchroniserEntete') && js.includes('Math.max(0, finAccueil'));
    ok('style.css : états de l\'en-tête (cache, plein)', css.includes('.site-header.cache') && css.includes('.site-header.plein'));
    ok('hub : feuilles de style et scripts en /assets/', hub.includes('/assets/css/aides.css') && hub.includes('/assets/js/aides.js') && !hub.includes('href="/style.css"'));
    ok('adresse contact@studionovae.org partout, jamais bonjour@', accueil.includes('contact@studionovae.org') && !accueil.includes('bonjour@') && !hub.includes('bonjour@'));
  } finally { serveur.kill(); fs.rmSync(path.join(RACINE, 'dist'), { recursive: true, force: true }); }
  console.log(echecs ? `\n✗ ${echecs} échec(s) : NE PAS POUSSER` : '\n✓ le site démarre et sert tout correctement depuis la nouvelle structure');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error('Le test a planté :', e.message); process.exit(2); });
