// Test des pages générées par Node (sans serveur) : à lancer après chaque modification de src/ ou du contenu.
//   npm test        (ou : node scripts/test-rendu.js)
// Chaque contrôle protège un comportement du site ; on en ajoute à mesure que le site évolue.
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const ASSETS = path.join(RACINE, 'public_html');
const { DOMAINE, SERVICES, REALISATIONS_VISIBLES } = require('../src/site');
const rendu = require('../src/rendu');

let echecs = 0;
const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? '✓' : '✗ ÉCHEC'}  ${nom}${detail ? '  → ' + detail : ''}`); };
const entites = (t) => t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const { pages } = rendu.construire();
const html = [...pages].filter(([, p]) => p.type.startsWith('text/html'));
const urls = new Set(pages.keys());

// --- Version automatique des fichiers CSS et JS : ?v=<empreinte du contenu> (un fichier modifié force le rechargement chez les visiteurs)
{
  const versions = require('../src/versions');
  const os = require('os');
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'novae-versions-'));
  fs.mkdirSync(path.join(dossier, 'assets', 'css'), { recursive: true });
  const fichier = path.join(dossier, 'assets', 'css', 'essai.css');
  fs.writeFileSync(fichier, 'body { color: red; }');
  const a = versions.asset('/assets/css/essai.css', dossier);
  fs.writeFileSync(fichier, 'body { color: blue; }');
  const b = versions.asset('/assets/css/essai.css', dossier);
  fs.writeFileSync(fichier, 'body { color: red; }');
  const c = versions.asset('/assets/css/essai.css', dossier);
  ok('versions : /assets/css/essai.css?v=<8 caractères hexadécimaux> ; le numéro change quand le contenu change', /^\/assets\/css\/essai\.css\?v=[0-9a-f]{8}$/.test(a) && a !== b);
  ok('versions : même contenu → même numéro (indépendant de la date du fichier)', a === c);
  ok('versions : fichier absent → adresse inchangée (aucun ?v= inventé)', versions.asset('/assets/css/absent.css', dossier) === '/assets/css/absent.css');
  ok('versions : seules les adresses /assets/css et /assets/js sont versionnées', versions.asset('/assets/images/hero.jpg', dossier) === '/assets/images/hero.jpg' && versions.asset('/contact', dossier) === '/contact');
  const sansVersion = [];
  for (const [url, p] of html) {
    for (const m of p.corps.matchAll(/(?:href|src)="(\/assets\/(?:css|js)\/[^"]+)"/g)) if (!/\?v=[0-9a-f]{8}$/.test(m[1])) sansVersion.push(`${url} → ${m[1]}`);
  }
  ok('toutes les pages : chaque feuille de style et chaque script (/assets/css, /assets/js) porte son numéro de version', sansVersion.length === 0, sansVersion.slice(0, 3).join(' ; '));
  const memeVersion = new Set();
  for (const [, p] of html) for (const m of p.corps.matchAll(/\/assets\/css\/style\.css\?v=([0-9a-f]{8})/g)) memeVersion.add(m[1]);
  ok('toutes les pages : style.css a le même numéro partout', memeVersion.size === 1, [...memeVersion].join(','));
}

// --- Menu burger (téléphone) : bouton dans l'en-tête et panneau plein écran, identiques sur toutes les pages
{
  const { SERVICES: SERVICES_BURGER, urlService: urlServiceBurger } = require('../src/site');
  const manques = [];
  for (const [url, p] of html) {
    const unique = (motif) => (p.corps.match(motif) || []).length === 1;
    const panneau = (p.corps.match(/<div class="menu-mobile" id="menu-mobile"[\s\S]*?<\/nav>\s*<\/div>/) || [''])[0];
    if (!unique(/<button type="button" class="burger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="menu-mobile">/g)) manques.push(`${url} : bouton burger`);
    if (!/<div class="menu-mobile" id="menu-mobile" role="dialog" aria-modal="true" aria-label="Menu">/.test(p.corps)) manques.push(`${url} : panneau`);
    if (!/<button type="button" class="menu-fermer" aria-label="Fermer le menu">/.test(panneau)) manques.push(`${url} : bouton Fermer`);
    for (const lien of [...SERVICES_BURGER.map((s) => urlServiceBurger(s.slug)), '/#methode', '/a-propos', '/aides-creation-digitale/', '/contact']) if (!panneau.includes(`href="${lien}"`)) manques.push(`${url} : lien ${lien}`);
    if (!/class="btn-devis"/.test(panneau)) manques.push(`${url} : bouton devis`);
  }
  ok('toutes les pages : un bouton burger, un panneau de menu (services, Méthode, À propos, aides, Nous contacter, bouton devis) et un bouton Fermer', manques.length === 0, manques.slice(0, 3).join(' ; '));
}

// --- Ensemble des pages attendues
const attendues = ['/', '/a-propos', ...SERVICES.map((s) => `/services/${s.slug}`), '/aides-creation-digitale/', '/sitemap.xml', '/robots.txt'];
ok('toutes les pages attendues sont générées', attendues.every((u) => urls.has(u)), attendues.filter((u) => !urls.has(u)).join(', '));
ok('une page par région des aides', html.filter(([u]) => /^\/aides-creation-digitale\/.+\/$/.test(u)).length >= 12);

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
const ordre = SERVICES.map((s) => `/services/${s.slug}`);
const menusOk = html.every(([, p]) => {
  const m = [...p.corps.match(/<div class="submenu">([\s\S]*?)<\/div>/)[1].matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
  return JSON.stringify(m) === JSON.stringify(ordre);
});
ok('menu Services identique et complet sur toutes les pages', menusOk);

// --- Accueil
const accueil = pages.get('/').corps;
ok('accueil : 6 tuiles de services, réalisations (si affichées), 4 étapes de méthode', (accueil.match(/class="tuile"/g) || []).length === 6 && (accueil.match(/class="projet"/g) || []).length === (REALISATIONS_VISIBLES ? 4 : 0) && (accueil.match(/class="etape"/g) || []).length === 4);
ok('accueil : les 6 tuiles de services sont dans la même grille, à égalité', (accueil.match(/<div class="tuiles" id="offres">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/) || [, ''])[1].split('class="tuile"').length === 7);
ok("accueil : image du héros (œil numérique), accroche et feuille maquette.css", accueil.includes('hero-oeil-numerique.webp') && accueil.includes('Des outils qui travaillent') && accueil.includes('/assets/css/maquette.css') && fs.existsSync(path.join(ASSETS, 'assets/images/hero-oeil-numerique.webp')));
ok('accueil : quatre « Demander un devis » (en-tête, menu burger, accroche, appel final) et lien « Voir les services »', (accueil.match(/Demander un devis/g) || []).length === 4 && accueil.includes('class="hero-voir"'));
ok('accueil : « (e-commerce) » insécable dans la tuile Boutique', accueil.includes('(e&#8209;commerce)'));
ok("accueil : bouton « Demander un devis » dans l'en-tête et dans l'accroche", accueil.includes('nav-devis') && accueil.includes('hero-actions'));
ok('accueil : ancres #aides #services #methode #contact (et #realisations si affichées)', ['id="aides"', 'id="services"', 'id="methode"', 'id="contact"'].every((a) => accueil.includes(a)) && accueil.includes('id="realisations"') === REALISATIONS_VISIBLES);

// --- Services
for (const s of SERVICES) {
  const p = pages.get(`/services/${s.slug}`).corps;
  const voir = [...((p.match(/<div class="suite">([\s\S]*?)<\/div>/) || [, ''])[1]).matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
  ok(`${s.slug} : « Les autres façons de travailler ensemble » = les 5 autres services`, voir.length === 5 && !voir.includes(`/services/${s.slug}`));
  ok(`${s.slug} : héros court avec fil d'Ariane et bouton « Demander un devis pour ${s.devis} »`, p.includes('class="hero hero-court"') && p.includes('class="fil"') && p.includes(`Demander un devis pour ${s.devis}`) && p.includes('<body class="page-service">'));
}
const vitrine = pages.get('/services/site-vitrine').corps;
ok('site-vitrine : copie de la maquette (deux formules, trois étapes, appel final)', vitrine.includes('Deux formules, selon votre autonomie') && vitrine.includes('class="formule phare"') && (vitrine.match(/class="etape"/g) || []).length === 3 && vitrine.includes('Parlons de votre vitrine.'));
ok('video-ugc : formulaire de demande présent', pages.get('/services/video-ugc').corps.includes('class="contact-form"'));

// --- Aides : FAQ identique entre texte visible et données structurées
for (const [url, p] of html.filter(([u]) => u.startsWith('/aides-creation-digitale/'))) {
  const graph = JSON.parse(p.corps.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const faq = graph.find((x) => x['@type'] === 'FAQPage').mainEntity.map((e) => [e.name, e.acceptedAnswer.text]);
  const visibles = [...p.corps.matchAll(/<details[^>]*><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => [entites(m[1]), entites(m[2])]);
  ok(`${url} : questions-réponses visibles = données structurées`, JSON.stringify(faq) === JSON.stringify(visibles), `${faq.length}/${visibles.length}`);
}
ok('hub des aides : données du parcours (AIDES) et scripts', pages.get('/aides-creation-digitale/').corps.includes('window.AIDES') && pages.get('/aides-creation-digitale/').corps.includes('/assets/js/aides.js'));

// --- Hub des aides : en-tête bleu nuit à 60 % d'opacité avec flou (le hub seulement, pas les pages de région)
const cssAides = fs.readFileSync(path.join(ASSETS, 'assets/css/aides.css'), 'utf8');
ok('hub des aides : le corps de page porte la classe aides-hub, les pages de région non', /<body class="aides aides-hub">/.test(pages.get('/aides-creation-digitale/').corps) && html.filter(([u]) => /^\/aides-creation-digitale\/.+\/$/.test(u)).every(([, p]) => !/aides-hub/.test(p.corps)));
const regleEntete = (cssAides.match(/\.aides-hub \.site-header, \.aides-hub \.site-header\.plein \{[^}]*\}/) || [''])[0];
ok('aides.css : en-tête du hub en fond bleu nuit 100 % (rgba(10, 18, 48, 1)) avec flou', /background: rgba\(10, 18, 48, 1\)/.test(regleEntete) && /backdrop-filter: blur\(12px\)/.test(regleEntete) && /-webkit-backdrop-filter: blur\(12px\)/.test(regleEntete));
ok('aides.css : logo et menu clairs sur le hub (texte lisible sur le fond bleu nuit)', /\.aides-hub \.logo \{ color: #fff; \}/.test(cssAides) && /\.aides-hub nav > a, \.aides-hub \.menu-trigger \{ color: #fff;/.test(cssAides));

// --- Hero de l'accueil sur téléphone : pastille remontée sous l'en-tête, titre / texte / bouton poussés en bas
const cssMaquette = fs.readFileSync(path.join(ASSETS, 'assets/css/maquette.css'), 'utf8');
const blocTel = (cssMaquette.match(/@media \(max-width: 650px\) \{\s*\/\* Hero de l'accueil[\s\S]*?\n\}/) || [''])[0];
ok("hero accueil téléphone : grille photo (tout l'espace libre) / contenu / bande, photo et voile empilés sans ourlet visible (voile débordant de 2 px), pastille masquée, bouton pleine largeur, lucioles sur les 66 % du haut", /\.accueil \.hero \{[^}]*display: grid;[^}]*grid-template-rows: 1fr auto auto;[^}]*min-height: 100svh;/.test(blocTel) && /\.accueil \.hero \.hero-bg \{[^}]*position: relative !important;[^}]*grid-area: 1 \/ 1;[^}]*height: auto !important;[^}]*transform: none !important;/.test(blocTel) && /\.accueil \.hero \.hero-overlay \{[^}]*position: relative;[^}]*grid-area: 1 \/ 1;[^}]*margin-bottom: -2px;/.test(blocTel) && /\.accueil \.hero \.hero-content \{[^}]*grid-row: 2;[^}]*padding-top: 0;[^}]*padding-bottom: 12px;/.test(blocTel) && /\.accueil \.hero \.hero-voir \{[^}]*grid-row: 3;[^}]*background: #0a1230;[^}]*text-align: right;/.test(blocTel) && /\.accueil \.hero \.eyebrow-pill \{[^}]*display: none;/.test(blocTel) && /\.accueil \.hero \.hero-content \.hero-bottom \{[^}]*gap: 24px;/.test(blocTel) && /\.accueil \.hero \.hero-content \.btn-devis \{[^}]*width: 100%;/.test(blocTel) && /\.accueil \.hero \.fireflies \{[^}]*bottom: 34%;/.test(blocTel));

// --- Hero plein écran (ordinateur et téléphone) : la fine ligne « Voir les services » est DANS le hero
const heroHtml = (accueil.match(/<section class="hero">[\s\S]*?<\/section>/) || [''])[0];
const sectionServices = (accueil.match(/<section class="section" id="services">[\s\S]*?<\/section>/) || [''])[0];
ok('accueil : « Voir les services » est dans le hero (bande .hero-voir, lien vers #offres) et plus dans la section des services', /<div class="hero-voir"><a href="#offres">Voir les services <span>↓<\/span><\/a><\/div>/.test(heroHtml) && !/Voir les services/.test(sectionServices) && !/lien-offres/.test(accueil));
const cssAvantTel = cssMaquette.slice(0, cssMaquette.indexOf("/* Hero de l'accueil sur téléphone"));
ok('maquette.css : hero de l\'accueil plein écran sur tous les écrans (100svh, colonne, contenu en bas) avec une bande « Voir les services » sur fond clair #eef1f9', /\.accueil \.hero \{[^}]*flex-direction: column;[^}]*justify-content: flex-end;[^}]*align-items: stretch;[^}]*min-height: 100vh;[^}]*min-height: 100svh;/.test(cssAvantTel) && /\.accueil \.hero \.hero-voir \{[^}]*background: #eef1f9;/.test(cssAvantTel));
ok('maquette.css : sur téléphone, la bande « Voir les services » passe sur fond bleu nuit (#0a1230) avec un texte clair', /\.accueil \.hero \.hero-voir \{[^}]*background: #0a1230;/.test(blocTel) && /\.accueil \.hero \.hero-voir a \{[^}]*color: #fff;/.test(blocTel));

// --- Marges téléphone : 12 px sous 650 px
const css = fs.readFileSync(path.join(ASSETS, 'assets/css/style.css'), 'utf8');

// --- Menu burger : CSS (caché sur grand écran, visible à 650 px et moins, navigation de l'en-tête masquée) et script
{
  const baseBurger = (css.match(/^\.burger \{[^}]*\}/m) || [''])[0];
  const mobileBurger = (css.match(/@media \(max-width: 650px\) \{[\s\S]*?\n\}/) || [''])[0];
  const panneauCss = (css.match(/^\.menu-mobile \{[^}]*\}/m) || [''])[0];
  const js = fs.readFileSync(path.join(ASSETS, 'assets/js/site.js'), 'utf8');
  ok('style.css : bouton burger caché par défaut, affiché à 650 px et moins, où la navigation de l\'en-tête est remplacée par le menu', /display: none;/.test(baseBurger) && /\.burger \{[^}]*display: (flex|inline-flex|block);/.test(mobileBurger) && /\.site-header nav \{ display: none; \}/.test(mobileBurger));
  ok('style.css : panneau du menu plein écran, bleu nuit, au-dessus de l\'en-tête (z-index > 30), invisible tant qu\'il n\'est pas ouvert', /position: fixed;/.test(panneauCss) && /inset: 0;/.test(panneauCss) && /background: #0a1230;/.test(panneauCss) && Number((panneauCss.match(/z-index: (\d+);/) || [])[1]) > 30 && /visibility: hidden;/.test(panneauCss) && /^\.menu-mobile\.ouvert \{[^}]*visibility: visible;/m.test(css));
  const lienCss = (css.match(/^\.menu-mobile-liens a:not\(\.btn-devis\) \{[^}]*\}/m) || [''])[0];
  const servicesCss = (css.match(/^\.menu-mobile-liens > a:nth-of-type\(-n\+6\) \{[^}]*\}/m) || [''])[0];
  ok('style.css : menu burger — une seule taille de police (1.3rem) pour tous les liens, services compris ; 64 px d\'espace au-dessus de « Services » ; trait séparateur conservé', /font-size: 1\.3rem;/.test(lienCss) && !/font-size/.test(servicesCss) && /\.menu-mobile \.menu-mobile-liens \{[^}]*margin: 64px 0 0;/.test(css) && /^\.menu-mobile-trait \{[^}]*height: 1px;/m.test(css) && /<span class="menu-mobile-trait"><\/span>/.test(pages.get('/').corps));
  ok('site.js : le burger ouvre et ferme le menu (aria-expanded, classe ouvert, page non défilante), Échap et un clic sur un lien le ferment', /aria-expanded/.test(js) && /menu-mobile/.test(js) && /classList\.add\('ouvert'\)/.test(js) && /'Escape'/.test(js) && /menu-ouvert/.test(js));
}

// --- Bouton « Demander un devis » du hero : au-dessus de l'en-tête (30 > 20) sur grand écran, SOUS l'en-tête à 950 px et moins (il ne s'y intègre plus)
const zEntete = Number((css.match(/\.site-header \{[^}]*z-index: (\d+);/) || [])[1]);
const zBoutonGrand = Number((css.match(/\.hero-actions \{[^}]*z-index: (\d+);/) || [])[1]);
const zBoutonPetit = Number((css.match(/@media \(max-width: 950px\) \{[^@]*\.hero-actions \{ z-index: (\d+); \}/) || [])[1]);
ok('style.css : bouton du hero devant l\'en-tête au-dessus de 950 px, derrière l\'en-tête à 950 px et moins', zEntete === 20 && zBoutonGrand > zEntete && zBoutonPetit > 0 && zBoutonPetit < zEntete, `en-tête ${zEntete}, bouton ${zBoutonGrand}, bouton ≤ 950 px : ${zBoutonPetit}`);

ok('style.css : marges latérales de 12 px sur téléphone', /@media \(max-width: 650px\) \{\s*:root \{ --gutter: 12px; \}/.test(css));

// --- Feuilles de style : palette bleu nuit, en-tête (réglages demandés) et bouton vert
const cssAccueil = fs.readFileSync(path.join(ASSETS, 'assets/css/maquette.css'), 'utf8');
const js = fs.readFileSync(path.join(ASSETS, 'assets/js/site.js'), 'utf8');
ok('palette : plus aucun vert turquoise ni noir-vert dans les feuilles de style', !/#4fc2ba|#1a7f77|#0b1514|#9fd8d3|#146b64/i.test(css + cssAccueil + fs.readFileSync(path.join(ASSETS, 'assets/css/aides.css'), 'utf8')));
ok('bouton « Demander un devis » et point du logo : même vert vif', css.includes('--vif: #a8dc5a;') && css.includes('background: var(--vif); color: #16260a !important;') && css.includes('.logo span { color: var(--vif); }'));
ok("en-tête : survol et soulignement animé en vert vif, texte +2 px", css.includes('color: var(--vif); opacity: 1;') && css.includes('height: 2px; background: var(--vif);') && css.includes('calc(0.88rem + 2px)') && css.includes('calc(0.95rem + 2px)'));
ok("en-tête : le bouton de l'accroche passe devant l'en-tête et s'aligne sur celui de l'en-tête", css.includes('z-index: 30') && css.includes('.nav-devis { margin-left: 15px; margin-right: 15px; }'));
ok("en-tête : fond bleu nuit translucide dès le premier défilement", js.includes('entete.classList.toggle("plein", y > 2)'));
ok("accueil : parallaxe du héros active (couche décalée vers le haut, script de défilement)", cssAccueil.includes('top: -40vh;') && accueil.includes('hero-bg parallax-layer') && js.includes("querySelectorAll('.parallax-layer')"));
ok("accueil : réalisations en carrousel à glisser, avec points de position", (!REALISATIONS_VISIBLES || (accueil.includes('class="projets" data-glisser') && accueil.includes('class="dots"'))) && cssAccueil.includes('scroll-snap-type: x mandatory') && js.includes("querySelectorAll('[data-glisser]')"));
ok("apparition au défilement : classe .js dans l'en-tête, styles .rv/.vu, script sans effet si « réduire les animations »", accueil.includes("classList.add('js')") && css.includes('.js .rv {') && css.includes('.js .rv.vu {') && js.includes("new IntersectionObserver") && /if \(!reduced && !robot && 'IntersectionObserver' in window\)/.test(js) && js.includes('window.innerHeight > 3000'));

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
