// Test des pages générées par Node (sans serveur) : à lancer après chaque modification de src/ ou du contenu.
//   npm test        (ou : node scripts/test-rendu.js)
// Chaque contrôle protège un comportement du site ; on en ajoute à mesure que le site évolue.
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const ASSETS = path.join(RACINE, 'public_html');
const { DOMAINE, SERVICES } = require('../src/site');
const rendu = require('../src/rendu');

let echecs = 0;
const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? '✓' : '✗ ÉCHEC'}  ${nom}${detail ? '  → ' + detail : ''}`); };
const entites = (t) => t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const { pages } = rendu.construire();
const html = [...pages].filter(([, p]) => p.type.startsWith('text/html'));
const urls = new Set(pages.keys());

// --- Ensemble des pages attendues
const attendues = ['/', '/a-propos.html', ...SERVICES.map((s) => `/services/${s.slug}.html`), '/aide-creation-site-web/', '/sitemap.xml', '/robots.txt'];
ok('toutes les pages attendues sont générées', attendues.every((u) => urls.has(u)), attendues.filter((u) => !urls.has(u)).join(', '));
ok('une page par région des aides', html.filter(([u]) => /^\/aide-creation-site-web\/.+\/$/.test(u)).length >= 12);

// --- Chaque page HTML
for (const [url, p] of html) {
  const h = p.corps;
  const titre = (h.match(/<title>([^<]*)<\/title>/) || [])[1];
  const ld = (h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  let ldOk = false; try { JSON.parse(ld); ldOk = true; } catch { /* invalide */ }
  const erreurs = [];
  if (!titre || titre.length > 120) erreurs.push('titre');
  if (!h.includes(`<link rel="canonical" href="${DOMAINE}${url}" />`)) erreurs.push('canonical');
  if (!/<meta name="description" content="[^"]{40,}"/.test(h)) erreurs.push('description');
  if (!ldOk) erreurs.push('JSON-LD');
  if ((h.match(/<h1[ >]/g) || []).length !== 1) erreurs.push('un seul h1');
  if (!h.includes('<main id="top">') || !h.includes('<footer>') || !h.includes('class="site-header"')) erreurs.push('structure');
  if (h.includes('bonjour@') || !h.includes('contact@studionovae.org')) erreurs.push('adresse contact');
  if (!h.includes('Designed by Magnific')) erreurs.push('mention Magnific');
  if (!h.includes('/assets/js/site.js')) erreurs.push('site.js');
  ok(`${url} : titre, canonical, description, JSON-LD, structure`, erreurs.length === 0, erreurs.join(', '));
}

// --- Liens internes et fichiers référencés
const manquants = [];
for (const [url, p] of html) {
  for (const [, cible] of p.corps.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    if (cible.startsWith('/assets/')) { if (!fs.existsSync(path.join(ASSETS, cible))) manquants.push(`${url} → ${cible}`); }
    else if (!urls.has(cible)) manquants.push(`${url} → ${cible}`);
  }
  for (const [, cible] of p.corps.matchAll(/url\('(\/assets\/[^']+)'\)/g)) if (!fs.existsSync(path.join(ASSETS, cible))) manquants.push(`${url} → ${cible}`);
  for (const [, img] of p.corps.matchAll(/content="https:\/\/studionovae\.org(\/assets\/[^"]+)"/g)) if (!fs.existsSync(path.join(ASSETS, img))) manquants.push(`${url} → ${img}`);
}
ok('tous les liens internes, images et fichiers référencés existent', manquants.length === 0, [...new Set(manquants)].slice(0, 5).join(' | '));

// --- Plan du site et robots.txt
const plan = pages.get('/sitemap.xml').corps;
ok('sitemap.xml : une entrée par page HTML', html.every(([u]) => plan.includes(`<loc>${DOMAINE}${u}</loc>`)) && (plan.match(/<loc>/g) || []).length === html.length);
ok('robots.txt : autorise tout et pointe vers le sitemap', /Allow: \//.test(pages.get('/robots.txt').corps) && pages.get('/robots.txt').corps.includes(`${DOMAINE}/sitemap.xml`));

// --- Menus : les six services partout, dans le même ordre
const ordre = SERVICES.map((s) => `/services/${s.slug}.html`);
const menusOk = html.every(([, p]) => {
  const m = [...p.corps.match(/<div class="submenu">([\s\S]*?)<\/div>/)[1].matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
  return JSON.stringify(m) === JSON.stringify(ordre);
});
ok('menu Services identique et complet sur toutes les pages', menusOk);

// --- Accueil
const accueil = pages.get('/').corps;
ok('accueil : 6 tuiles de services, 4 réalisations, 4 étapes de méthode', (accueil.match(/class="tuile"/g) || []).length === 6 && (accueil.match(/class="projet"/g) || []).length === 4 && (accueil.match(/class="etape"/g) || []).length === 4);
ok('accueil : les 6 tuiles de services sont dans la même grille, à égalité', (accueil.match(/<div class="tuiles" id="offres">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/) || [, ''])[1].split('class="tuile"').length === 7);
ok("accueil : image du héros (œil numérique), accroche et feuille maquette.css", accueil.includes('hero-oeil-numerique.jpg') && accueil.includes('Des outils qui travaillent') && accueil.includes('/assets/css/maquette.css') && fs.existsSync(path.join(ASSETS, 'assets/images/hero-oeil-numerique.jpg')));
ok('accueil : trois « Demander un devis » (en-tête, accroche, appel final) et lien « Voir les services »', (accueil.match(/Demander un devis/g) || []).length === 3 && accueil.includes('class="lien-offres"'));
ok('accueil : « (e-commerce) » insécable dans la tuile Boutique', accueil.includes('(e&#8209;commerce)'));
ok("accueil : bouton « Demander un devis » dans l'en-tête et dans l'accroche", accueil.includes('nav-devis') && accueil.includes('hero-actions'));
ok('accueil : ancres #aides #services #methode #realisations #contact', ['id="aides"', 'id="services"', 'id="methode"', 'id="realisations"', 'id="contact"'].every((a) => accueil.includes(a)));

// --- Services
for (const s of SERVICES) {
  const p = pages.get(`/services/${s.slug}.html`).corps;
  const voir = [...((p.match(/<div class="suite">([\s\S]*?)<\/div>/) || [, ''])[1]).matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
  ok(`${s.slug} : « Les autres façons de travailler ensemble » = les 5 autres services`, voir.length === 5 && !voir.includes(`/services/${s.slug}.html`));
  ok(`${s.slug} : héros court avec fil d'Ariane et bouton « Demander un devis pour ${s.devis} »`, p.includes('class="hero hero-court"') && p.includes('class="fil"') && p.includes(`Demander un devis pour ${s.devis}`) && p.includes('<body class="page-service">'));
}
const vitrine = pages.get('/services/site-vitrine.html').corps;
ok('site-vitrine : copie de la maquette (deux formules, trois étapes, appel final)', vitrine.includes('Deux formules, selon votre autonomie') && vitrine.includes('class="formule phare"') && (vitrine.match(/class="etape"/g) || []).length === 3 && vitrine.includes('Parlons de votre vitrine.'));
ok('video-ugc : formulaire de demande présent', pages.get('/services/video-ugc.html').corps.includes('class="contact-form"'));

// --- Aides : FAQ identique entre texte visible et données structurées
for (const [url, p] of html.filter(([u]) => u.startsWith('/aide-creation-site-web/'))) {
  const graph = JSON.parse(p.corps.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const faq = graph.find((x) => x['@type'] === 'FAQPage').mainEntity.map((e) => [e.name, e.acceptedAnswer.text]);
  const visibles = [...p.corps.matchAll(/<details[^>]*><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => [entites(m[1]), entites(m[2])]);
  ok(`${url} : questions-réponses visibles = données structurées`, JSON.stringify(faq) === JSON.stringify(visibles), `${faq.length}/${visibles.length}`);
}
ok('hub des aides : données du parcours (AIDES) et scripts', pages.get('/aide-creation-site-web/').corps.includes('window.AIDES') && pages.get('/aide-creation-site-web/').corps.includes('/assets/js/aides.js'));

// --- Marges téléphone : 12 px sous 650 px
const css = fs.readFileSync(path.join(ASSETS, 'assets/css/style.css'), 'utf8');
ok('style.css : marges latérales de 12 px sur téléphone', /@media \(max-width: 650px\) \{\s*:root \{ --gutter: 12px; \}/.test(css));

// --- Feuilles de style : palette bleu nuit, en-tête (réglages demandés) et bouton vert
const cssAccueil = fs.readFileSync(path.join(ASSETS, 'assets/css/maquette.css'), 'utf8');
const js = fs.readFileSync(path.join(ASSETS, 'assets/js/site.js'), 'utf8');
ok('palette : plus aucun vert turquoise ni noir-vert dans les feuilles de style', !/#4fc2ba|#1a7f77|#0b1514|#9fd8d3|#146b64/i.test(css + cssAccueil + fs.readFileSync(path.join(ASSETS, 'assets/css/aides.css'), 'utf8')));
ok('bouton « Demander un devis » et point du logo : même vert vif', css.includes('--vif: #a8dc5a;') && css.includes('background: var(--vif); color: #16260a !important;') && css.includes('.logo span { color: var(--vif); }'));
ok("en-tête : survol et soulignement animé en vert vif, texte +2 px", css.includes('color: var(--vif); opacity: 1;') && css.includes('height: 2px; background: var(--vif);') && css.includes('calc(0.88rem + 2px)') && css.includes('calc(0.95rem + 2px)'));
ok("en-tête : le bouton de l'accroche passe devant l'en-tête et s'aligne sur celui de l'en-tête", css.includes('z-index: 30') && css.includes('.nav-devis { margin-left: 15px; margin-right: 15px; }'));
ok("en-tête : fond bleu nuit translucide dès le premier défilement", js.includes('entete.classList.toggle("plein", y > 2)'));
ok("accueil : héros sans parallaxe, cadrage de la maquette", cssAccueil.includes('.accueil .hero .hero-bg { top: 0; }'));

// --- Rafraîchissement toutes les 24 h : reconstruction en arrière-plan, la version actuelle reste servie
(async () => {
  const reel = Date.now;
  rendu.demarrer();
  const avant = rendu.pages();
  ok('rafraîchissement : avant 24 h, la même table de pages est servie', rendu.pages() === avant);
  Date.now = () => reel() + rendu.DUREE_MS + 1000;
  const pendant = rendu.pages();
  ok('rafraîchissement : après 24 h, la version actuelle est servie pendant la reconstruction', pendant === avant);
  await new Promise((r) => setTimeout(r, 400));
  const apres = rendu.pages();
  Date.now = reel;
  ok('rafraîchissement : la reconstruction a remplacé les pages', apres !== avant && apres.size === avant.size);

  console.log(echecs ? `\n✗ ${echecs} échec(s)` : '\n✓ toutes les pages générées sont conformes');
  process.exit(echecs ? 1 : 0);
})();
