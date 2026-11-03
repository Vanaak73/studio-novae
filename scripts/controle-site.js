// Contrôle du site : tout ce que Rémi a validé, vérifié automatiquement.
//   node scripts/controle-site.js                         → teste public_html/ (serveur local démarré puis arrêté tout seul)
//   node scripts/controle-site.js --prod [https://...]    → teste le site en ligne (par défaut https://studionovae.org)
// Variables : PUPPETEER_PATH (dossier de puppeteer-core), CHROME_PATH. Code de sortie 1 s'il reste un échec.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const PUPPETEER = process.env.PUPPETEER_PATH || 'D:/projet/producteurslocaux/node_modules/puppeteer-core';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const iProd = args.indexOf('--prod');
const PROD = iProd >= 0 ? (args[iProd + 1] && !args[iProd + 1].startsWith('--') ? args[iProd + 1] : 'https://studionovae.org') : null;
const PORT = 4177;
const BASE = PROD ? PROD.replace(/\/$/, '') : `http://localhost:${PORT}`;

const SERVICES = ['site-vitrine', 'outil-metier', 'boutique-en-ligne', 'automatisation-ia', 'video-ugc', 'community-management'];
const REGIONS = require('../aides-src/donnees-regions.js').map((r) => r.slug);
const PAGES = ['/', '/a-propos.html', ...SERVICES.map((s) => `/services/${s}.html`), '/aide-creation-site-web/', ...REGIONS.map((r) => `/aide-creation-site-web/${r}/`)];
const PAGES_AIDES = PAGES.filter((p) => p.startsWith('/aide-creation-site-web/'));

const att = (ms) => new Promise((r) => setTimeout(r, ms));
const resultats = [];
const verifier = (groupe, nom, ok, detail = '') => { resultats.push({ groupe, nom, ok: !!ok, detail }); };

async function demarrerServeur() {
  const enfant = spawn(process.execPath, ['server.js'], { cwd: RACINE, env: { ...process.env, PORT: String(PORT), NOINDEX: '1' }, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { const r = await fetch(BASE + '/'); if (r.ok) return enfant; } catch (e) { /* pas encore prêt */ } await att(250); }
  enfant.kill(); throw new Error('le serveur local ne démarre pas');
}

(async () => {
  const puppeteer = require(PUPPETEER);
  const serveur = PROD ? null : await demarrerServeur();
  const navigateur = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  try {
    // 1) chaque page : réponse 200, aucune ressource en échec (images, CSS, JS), aucune erreur JS, aucun débordement
    const menus = {};
    for (const [vue, largeur] of [['bureau', 1280], ['téléphone', 390]]) {
      for (const url of PAGES) {
        const page = await navigateur.newPage(); await page.setViewport({ width: largeur, height: 800 });
        const echecs = [], erreurs = [];
        page.on('response', (r) => { if (r.status() >= 400 && !/fonts\.g/.test(r.url())) echecs.push(r.status() + ' ' + r.url().replace(BASE, '')); });
        page.on('pageerror', (e) => erreurs.push(e.message));
        const rep = await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 45000 }).catch((e) => ({ status: () => 0, erreur: e.message }));
        await att(250);
        const info = await page.evaluate(() => {
          const h = document.querySelector('.site-header');
          const lien = (s) => { const a = document.querySelector(s); if (!a) return null; const t = [...a.childNodes].find((x) => x.nodeType === 3 && x.textContent.trim()); if (!t) return null; const g = document.createRange(); g.selectNodeContents(t); const q = g.getBoundingClientRect(); return q.width ? Math.round(q.left) + ',' + Math.round(q.top + q.height / 2) : null; };
          return { debord: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
            haut: h ? Math.round(h.getBoundingClientRect().height) : 0, classes: h ? h.className : '', h1: document.querySelectorAll('h1').length,
            menu: [lien('.menu-trigger'), lien('nav > a[href$="#realisations"]'), lien('nav > a[href$="#methode"]'), lien('nav > a[href$="a-propos.html"]'), lien('.nav-contact')].join(' | ') };
        });
        const groupe = 'Pages ' + vue;
        verifier(groupe, `${url} répond 200`, rep.status() === 200, rep.erreur || rep.status());
        verifier(groupe, `${url} : aucune ressource en échec (images, CSS, JS)`, echecs.length === 0, [...new Set(echecs)].slice(0, 3).join(' ; '));
        verifier(groupe, `${url} : aucune erreur JavaScript`, erreurs.length === 0, erreurs[0] || '');
        verifier(groupe, `${url} : pas de débordement horizontal`, !info.debord);
        if (url.startsWith('/aide-creation-site-web/')) verifier(groupe, `${url} : un seul titre H1`, info.h1 === 1, 'h1 : ' + info.h1);
        if (vue === 'bureau') {
          verifier('En-tête', `${url} : taille normale en haut de page (pas de mode compact)`, info.haut === (menus.__haut = menus.__haut || info.haut) && !/plein|cache/.test(info.classes), `hauteur ${info.haut} px, classes « ${info.classes} »`);
          menus[url] = info.menu;
        }
        await page.close();
      }
    }
    const refMenu = menus['/'];
    for (const url of PAGES) if (url !== '/') verifier('En-tête', `${url} : menu exactement à la même place que sur l'accueil`, menus[url] === refMenu, menus[url] + '  (accueil : ' + refMenu + ')');

    // 2) comportement de l'en-tête : se cache en descendant, réapparaît en remontant, reste visible après un rechargement
    for (const [url, y] of [['/', 2800], ['/aide-creation-site-web/', 900], ['/aide-creation-site-web/bretagne/', 700], ['/services/site-vitrine.html', 900]]) {
      const page = await navigateur.newPage(); await page.setViewport({ width: 1280, height: 700 });
      await page.goto(BASE + url, { waitUntil: 'networkidle2' }); await att(400);
      const classe = () => page.evaluate(() => document.querySelector('.site-header').className);
      const haut = () => page.evaluate(() => Math.round(document.querySelector('.site-header').getBoundingClientRect().top));
      await page.evaluate((v) => scrollTo(0, v), y); await att(800); const descente = await classe();
      await page.evaluate((v) => scrollTo(0, v - 150), y); await att(800); const remontee = await classe(); const hautRemontee = await haut();
      await page.reload({ waitUntil: 'networkidle2' }); await att(1000); const apresF5 = await classe(); const hautF5 = await haut();
      verifier('En-tête', `${url} : se cache en descendant`, /cache/.test(descente), descente);
      verifier('En-tête', `${url} : réapparaît en remontant (visible, avec son fond)`, !/cache/.test(remontee) && /plein/.test(remontee) && hautRemontee >= -1, `${remontee}, haut ${hautRemontee}`);
      verifier('En-tête', `${url} : visible avec son fond après un rechargement (F5) à mi-page`, !/cache/.test(apresF5) && /plein/.test(apresF5) && hautF5 >= -1, `${apresF5}, haut ${hautF5}`);
      await page.close();
    }

    // 3) accueil : relais du bouton « Demander un devis »
    {
      const page = await navigateur.newPage(); await page.setViewport({ width: 1280, height: 700 });
      await page.goto(BASE + '/', { waitUntil: 'networkidle2' }); await att(500);
      const etat = () => page.evaluate(() => ({ entete: getComputedStyle(document.querySelector('.nav-devis')).visibility, accueil: document.querySelector('.hero-actions .btn-devis') ? getComputedStyle(document.querySelector('.hero-actions .btn-devis')).visibility : 'absent', lien: (document.querySelector('.nav-devis') || {}).href || '' }));
      const haut = await etat(); await page.evaluate(() => scrollTo(0, 800)); await att(900); const bas = await etat();
      verifier('Accueil', 'bouton « Demander un devis » : visible dans l\'accroche en haut de page, caché dans l\'en-tête', haut.accueil === 'visible' && haut.entete === 'hidden', JSON.stringify(haut));
      verifier('Accueil', 'bouton « Demander un devis » : relais vers l\'en-tête après défilement', bas.entete === 'visible' && bas.accueil === 'hidden', JSON.stringify(bas));
      verifier('Accueil', 'bouton « Demander un devis » : mène quelque part (pas de #devis)', !/#devis$/.test(haut.lien) && haut.lien !== '', haut.lien);
      await page.close();
    }

    // 4) questionnaire du hub : parcours, retour arrière, redirection vers la page de la région
    {
      const page = await navigateur.newPage(); await page.setViewport({ width: 1280, height: 800 });
      await page.goto(BASE + '/aide-creation-site-web/', { waitUntil: 'networkidle2' }); await att(400);
      const question = () => page.evaluate(() => document.querySelector('.qs-question') && document.querySelector('.qs-question').textContent);
      await page.click('.qs-choix button[data-v="Bretagne"]'); await att(200);
      await page.click('.qs-choix button[data-v="moins6"]'); await att(200);
      await page.goBack(); await att(300); const q2 = await question();
      await page.goBack(); await att(300); const q1 = await question();
      const garde = await page.evaluate(() => document.querySelectorAll('.qs-etape.fait').length);
      verifier('Questionnaire', 'le bouton Retour du navigateur recule d\'une étape', /Où en est/.test(q2) && /Dans quelle région/.test(q1), q2 + ' / ' + q1);
      verifier('Questionnaire', 'les réponses déjà données sont conservées', garde >= 1, 'étapes validées : ' + garde);
      await page.click('.qs-choix button[data-v="Bretagne"]'); await att(200); await page.click('.qs-choix button[data-v="moins6"]'); await att(200);
      await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('.qs-choix button[data-v="site"]')]);
      verifier('Questionnaire', 'le dernier clic mène à la page de la région', /\/aide-creation-site-web\/bretagne\/$/.test(page.url()), page.url());
      await page.close();
    }

    // 5) contenu des pages aides : questions-réponses = données structurées, écriture positive, adresse de contact
    for (const url of PAGES_AIDES) {
      const page = await navigateur.newPage(); await page.setViewport({ width: 1280, height: 800 });
      await page.goto(BASE + url, { waitUntil: 'networkidle2' });
      const c = await page.evaluate(() => {
        const n = (t) => t.replace(/\s+/g, ' ').trim();
        const g = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].find((x) => x['@type'] === 'FAQPage').mainEntity.map((e) => [n(e.name), n(e.acceptedAnswer.text)]);
        const v = [...document.querySelectorAll('.az-faq details')].map((d) => [n(d.querySelector('summary').textContent), n(d.querySelector('p').textContent)]);
        const texte = [...document.querySelectorAll('main section')].map((s) => s.innerText).join(' ');
        return { faq: JSON.stringify(g) === JSON.stringify(v), texte, bonjour: document.documentElement.innerHTML.includes('bonjour@studionovae'), contact: document.documentElement.innerHTML.includes('contact@studionovae.org') };
      });
      const negations = (c.texte.match(/(?<![\p{L}\p{N}])(sans|pas|non|aucun|aucune|jamais|ne)(?![\p{L}\p{N}-])|(?<![\p{L}\p{N}])n'/giu) || []);
      verifier('Contenu aides', `${url} : questions-réponses identiques aux données structurées`, c.faq);
      verifier('Contenu aides', `${url} : écriture positive (aucune négation)`, negations.length === 0, negations.slice(0, 4).join(', '));
      verifier('Contenu aides', `${url} : adresse contact@studionovae.org, jamais bonjour@`, c.contact && !c.bonjour);
      await page.close();
    }
  } finally {
    await navigateur.close();
    if (serveur) serveur.kill();
  }

  // Rapport
  const groupes = [...new Set(resultats.map((r) => r.groupe))];
  console.log(`\n=== CONTRÔLE ${PROD ? 'EN LIGNE : ' + BASE : 'LOCAL (public_html)'} ===`);
  for (const g of groupes) {
    const lignes = resultats.filter((r) => r.groupe === g); const ko = lignes.filter((r) => !r.ok);
    console.log(`\n${ko.length ? '✗' : '✓'} ${g} : ${lignes.length - ko.length}/${lignes.length}`);
    for (const r of ko.slice(0, 12)) console.log(`    ÉCHEC  ${r.nom}${r.detail ? '  →  ' + r.detail : ''}`);
    if (ko.length > 12) console.log(`    … et ${ko.length - 12} autres échecs`);
  }
  const echecs = resultats.filter((r) => !r.ok).length;
  console.log(`\n${echecs ? `✗ ${echecs} ÉCHEC(S) sur ${resultats.length} vérifications` : `✓ TOUT PASSE : ${resultats.length} vérifications`}`);
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error('Le contrôle a planté :', e.message); process.exit(2); });
