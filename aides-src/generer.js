// Génère la section « Aides à la création de site web » dans public_html/aide-creation-site-web/ (hub + une page par région).
// Usage : node aides-src/generer.js   (puis npm run build pour copier public_html/ dans dist/)
const fs = require('fs');
const path = require('path');
const REGIONS = require('./donnees-regions.js');

const RACINE = path.join(__dirname, '..', 'public_html');
const SORTIE = path.join(RACINE, 'aide-creation-site-web');
const DOMAINE = 'https://studionovae.org';
const MAIL = 'contact@studionovae.org';
const DATE_RELEVE = '2 novembre 2026';
const DEVIS = `mailto:${MAIL}?subject=${encodeURIComponent('Demande de devis')}`;

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FIABILITE = {
  officiel: ['Source officielle', 'f-officiel'],
  annuaire: ["Annuaire d'aides, à confirmer", 'f-annuaire'],
  article: ['Source secondaire, à confirmer', 'f-article']
};
const NATIONALES = [
  { nom: 'Prêt garanti France Num', montant: 'Selon votre banque', texte: "Financement bancaire garanti par l'État, site internet compris." },
  { nom: 'Diagnostic et formations France Num', montant: 'Gratuit', texte: 'Test de maturité numérique et formations en ligne.' },
  { nom: "Aide au créateur d'entreprise (ARCE)", montant: '60 % des droits restants', texte: "Versée en capital aux demandeurs d'emploi indemnisés qui créent leur entreprise." }
];

const ICONE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230b1514'/%3E%3Cpath d='M18 48V16l28 32V16' fill='none' stroke='%234fc2ba' stroke-width='6' stroke-linejoin='round'/%3E%3C/svg%3E";

function tete({ titre, description, url, jsonld }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(titre)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${DOMAINE}${url}" />
  <meta name="theme-color" content="#eef1ee" />
  <link rel="icon" href="${ICONE}" />
  <meta property="og:site_name" content="Studio Novae" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(titre)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${DOMAINE}${url}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${esc(titre)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
  <link rel="stylesheet" href="/assets/css/style.css" />
  <link rel="stylesheet" href="/assets/css/aides.css" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@300;500;700&display=swap" rel="stylesheet" />
</head>
<body class="aides">

  <header class="site-header">
    <a class="logo" href="/" aria-label="Studio Novae, accueil">STUDIO <span>·</span> NOVAE</a>
    <nav>
      <div class="has-menu">
        <a class="menu-trigger" href="/#services" aria-haspopup="true">Services</a>
        <div class="submenu">
          <a href="/services/site-vitrine.html">Site vitrine</a>
          <a href="/services/outil-metier.html">Outil sur mesure</a>
          <a href="/services/boutique-en-ligne.html">Boutique en ligne</a>
          <a href="/services/automatisation-ia.html">Automatisation & IA</a>
          <a href="/services/video-ugc.html">Vidéo UGC (promotion)</a>
          <a href="/services/community-management.html">Community management</a>
        </div>
      </div>
      <a href="/#realisations">Réalisations</a>
      <a href="/#methode">Méthode</a>
      <a href="/a-propos.html">À propos</a>
      <a class="nav-contact" href="mailto:${MAIL}">Nous contacter</a>
      <a class="btn-devis nav-devis" href="${DEVIS}">Demander un devis</a>
    </nav>
  </header>

  <main id="top">
`;
}

const pied = (scripts = '') => `
  </main>

  <footer>
    <div>
      <a class="logo" href="/">STUDIO <span>·</span> NOVAE</a>
      <p>Développement web et automatisation IA, depuis la France.</p>
    </div>
    <div class="footer-links">
      <a href="/services/site-vitrine.html">Site vitrine</a>
      <a href="/services/outil-metier.html">Outil sur mesure</a>
      <a href="/services/boutique-en-ligne.html">Boutique en ligne</a>
      <a href="/services/automatisation-ia.html">Automatisation & IA</a>
      <a href="/services/video-ugc.html">Vidéo UGC (promotion)</a>
      <a href="/services/community-management.html">Community management</a>
      <a href="/aide-creation-site-web/">Aides à la création de site</a>
      <a href="/a-propos.html">À propos</a>
      <a href="mailto:${MAIL}">Contact</a>
    </div>
    <div class="footer-copy"><span>© 2026 Studio Novae</span><a href="#top">Retour en haut ↑</a></div>
  </footer>
${scripts}</body>
</html>
`;

const faqHtml = (items, ouvrirPremier = true) => items.map((f, i) =>
  `      <details${i === 0 && ouvrirPremier ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.r)}</p></details>`).join('\n');
const faqLd = (items) => ({ '@type': 'FAQPage', mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })) });
const fil = (...liens) => ({ '@type': 'BreadcrumbList', itemListElement: liens.map(([nom, url], i) => ({ '@type': 'ListItem', position: i + 1, name: nom, item: DOMAINE + url })) });
const listeRegions = (courante) => REGIONS.map((r) => `<a href="/aide-creation-site-web/${r.slug}/"${r.slug === courante ? ' aria-current="page"' : ''}>${esc(r.nom)}</a>`).join('');
const actionsDevis = `<a class="btn-aide" href="${DEVIS}">Demander un devis</a><a class="lien-contact" href="mailto:${MAIL}">Nous contacter</a>`;

// ---------- Hub ----------
const FAQ_HUB = [
  { q: "Existe-t-il des aides pour financer le site web d'une entreprise ?", r: "Oui, des aides existent et il est possible d'en faire la demande. Elles sont proposées par les régions, les départements, les intercommunalités et les communes, et complétées par des dispositifs nationaux comme le prêt garanti France Num. Leur nom, leur montant et leurs conditions évoluent au fil du temps." },
  { q: "Que propose l'État pour financer un site internet ?", r: "Au niveau national, le prêt garanti France Num, le diagnostic de maturité numérique et les formations gratuites de France Num sont proposés. Le soutien direct à la numérisation des petites entreprises passe aujourd'hui surtout par les territoires." },
  { q: "Pourquoi les aides changent-elles d'une région à l'autre ?", r: "Chaque collectivité fixe ses propres dispositifs, avec un nom, un plafond et des conditions qui lui sont propres. Atouts Numériques en Auvergne-Rhône-Alpes, l'INAC dans les Hauts-de-France ou les Défis numériques en Nouvelle-Aquitaine sont des exemples référencés dans les annuaires d'aides. Certaines communes et intercommunalités ajoutent leur propre soutien." },
  { q: "Quelles aides correspondent à mon entreprise ?", r: "Cela dépend de deux choses : l'endroit où se trouve votre entreprise et ce que vous voulez bâtir, qu'il s'agisse d'un site vitrine, d'un outil sur mesure, d'une boutique en ligne ou d'une automatisation. Le questionnaire en haut de cette page conduit en trois questions vers la page de votre région." },
  { q: "Que peut financer une aide au numérique ?", r: "Selon le dispositif, une aide peut couvrir tout ou partie de la conception d'un site vitrine, d'une boutique en ligne, d'un outil sur mesure ou d'une démarche d'automatisation. Les dépenses retenues sont précisées dans les conditions de chaque dispositif." },
  { q: "Quand faut-il déposer la demande d'aide ?", r: "Dans de nombreux dispositifs, la demande se dépose avant l'achat et la signature du devis. Lire les conditions du dispositif avant de lancer le projet permet de choisir le bon moment." },
  { q: "Une entreprise tout juste créée peut-elle bénéficier d'une aide ?", r: "Cela dépend du dispositif : certains s'adressent aux entreprises dès leur création, d'autres demandent une ancienneté minimale. Le questionnaire demande l'ancienneté de votre entreprise pour orienter vers les aides adaptées." },
  { q: "Quelle différence entre une aide à la création d'entreprise et une aide pour le site web ?", r: "Les aides à la création, comme l'ARCE ou l'ACRE, soutiennent le lancement de l'entreprise elle-même, sous forme de capital ou de réduction de cotisations. Les aides au numérique financent un projet précis, comme un site web. Les deux peuvent se compléter." },
  { q: "Où trouver les aides de ma région ?", r: "Chaque région dispose d'une page dédiée sur ce site, avec ses dispositifs détaillés. Le site de la région, la CCI et la CMA publient aussi les aides en vigueur." },
  { q: "Qui dépose la demande d'aide ?", r: "L'entreprise bénéficiaire dépose elle-même sa demande. Le prestataire qui réalise le projet fournit le devis détaillé joint au dossier." },
  { q: "Comment obtenir un devis adapté à une demande d'aide ?", r: "Un devis détaillé, avec des lignes séparées pour la conception, l'hébergement et la prise en main, facilite le dépôt du dossier. Vous pouvez demander ce devis à Studio Novae." }
];

function hub() {
  const donnees = {
    regions: REGIONS.map((r) => ({ nom: r.nom, slug: r.slug, aide: { nom: r.dispositifs[0].nom, montant: r.dispositifs[0].montant, points: r.dispositifs[0].points.slice(0, 2), niveau: r.dispositifs[0].niveau } })),
    fiabilite: Object.fromEntries(Object.entries(FIABILITE).map(([k, v]) => [k, v])),
    mail: MAIL
  };
  const titre = 'Aides pour créer le site web de son entreprise, selon la région — Studio Novae';
  const description = "Les aides existent pour financer le site web d'une entreprise : trois questions suffisent pour trouver celles de votre région et de votre projet.";
  const ld = { '@context': 'https://schema.org', '@graph': [faqLd(FAQ_HUB), fil(['Accueil', '/'], ['Aides à la création de site web', '/aide-creation-site-web/'])] };
  return tete({ titre, description, url: '/aide-creation-site-web/', jsonld: ld }) + `
    <section class="az az-claire az-intro">
      <div class="az-in">
        <p class="eyebrow">Aides à la création de site web</p>
        <h1>Les aides pour votre site web, <em>selon votre région</em></h1>
        <p class="chapo">Elles évoluent et changent d'un territoire à l'autre. Trois questions suffisent pour trouver les vôtres.</p>
        <div class="qs-etapes" id="etapes"></div>
        <div id="vue" aria-live="polite"></div>
      </div>
    </section>

    <section class="az az-sombre">
      <div class="az-in">
        <h2 class="az-titre">Ce qu'il faut savoir</h2>
        <div class="az-trois">
          <article><span class="num">1</span><h3>Elles évoluent</h3><p>Hier nationales, aujourd'hui surtout régionales, départementales ou communales.</p></article>
          <article><span class="num">2</span><h3>Chaque territoire a les siennes</h3><p>Un nom, un plafond et des conditions propres à chaque région.</p></article>
          <article><span class="num">3</span><h3>Votre région et votre projet décident</h3><p>Le questionnaire vous conduit vers la page de votre région.</p></article>
        </div>
      </div>
    </section>

    <section class="az az-claire az-zone-faq">
      <div class="az-in">
        <h2 class="az-titre">Questions fréquentes</h2>
        <div class="az-faq">
${faqHtml(FAQ_HUB)}
        </div>
        <p class="az-sources">Sources officielles :
          <a href="https://www.entreprises.gouv.fr/fr/numerique/enjeux/france-num-l-initiative-pour-accelerer-la-transformation-numerique-des-tpe/pme">France Num</a> ·
          <a href="https://aides-territoires.beta.gouv.fr/">Aides-territoires</a> ·
          <a href="https://mesaidespubliques.infogreffe.fr/aides/aide-au-developpement-numerique">Mes aides publiques</a></p>
      </div>
    </section>

    <section class="az az-claire">
      <div class="az-in">
        <h2 class="az-titre">Toutes les régions</h2>
        <div class="az-regions">${listeRegions()}</div>
        <div class="az-actions">${actionsDevis}</div>
      </div>
    </section>
` + pied(`  <script>window.AIDES = ${JSON.stringify(donnees)};</script>\n  <script src="/assets/js/aides.js" defer></script>\n  <script src="/assets/js/site.js" defer></script>\n`);
}

// ---------- Pages régions ----------
function questions(r) {
  const noms = r.dispositifs.map((d) => d.nom).join(', ');
  return [
    { q: `Existe-t-il une aide pour financer un site web ${r.lieu} ?`, r: r.resume },
    { q: `Quelles aides sont référencées ${r.lieu} ?`, r: `Les dispositifs identifiés ${r.lieu} sont : ${noms}. Leurs conditions en vigueur se confirment auprès de ${r.contact.includes('Région') ? 'la Région' : 'la collectivité'} avant toute demande.` },
    { q: `Qui peut en bénéficier ${r.lieu} ?`, r: r.beneficiaires },
    { q: `Où faire la demande ${r.lieu} ?`, r: r.contact },
    { q: `Qui dépose la demande d'aide ${r.lieu} ?`, r: "L'entreprise bénéficiaire dépose elle-même sa demande. Le prestataire qui réalise le projet fournit le devis détaillé joint au dossier." }
  ];
}

function pageRegion(r) {
  const items = questions(r);
  const url = `/aide-creation-site-web/${r.slug}/`;
  const titre = `Aides pour créer son site web ${r.lieu} — Studio Novae`;
  const description = `Les aides pour financer le site web d'une entreprise ${r.lieu} : dispositifs référencés, conditions, démarches et sources.`;
  const ld = { '@context': 'https://schema.org', '@graph': [faqLd(items), fil(['Accueil', '/'], ['Aides à la création de site web', '/aide-creation-site-web/'], [r.nom, url])] };
  const cartes = r.dispositifs.map((d) => `
          <article class="az-dispo">
            <div class="az-dispo-tete"><span class="az-type">${esc(d.type)}</span><span class="fiabilite ${FIABILITE[d.niveau][1]}">${FIABILITE[d.niveau][0]}</span></div>
            <h3>${esc(d.nom)}</h3>
            <span class="montant">${esc(d.montant)}</span>
            <ul>${d.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
            <a class="az-source" href="${esc(d.source.url)}" rel="noopener">${esc(d.source.titre)} ↗</a>
          </article>`).join('');
  const nat = NATIONALES.map((n) => `<article><span class="az-type">National</span><h3>${esc(n.nom)}</h3><span class="montant">${esc(n.montant)}</span><p>${esc(n.texte)}</p></article>`).join('');
  return tete({ titre, description, url, jsonld: ld }) + `
    <section class="az az-claire az-intro">
      <div class="az-in">
        <p class="fil"><a href="/aide-creation-site-web/">Aides à la création de site web</a> › ${esc(r.nom)}</p>
        <h1>Les aides pour votre site web ${esc(r.lieu)}</h1>
        <p class="chapo">${esc(r.resume)}</p>
        <div class="az-actions"><a class="btn-aide" href="${DEVIS}">Demander un devis</a><a class="lien-contact" href="/aide-creation-site-web/">Choisir une autre région</a></div>
      </div>
    </section>

    <section class="az az-blanche">
      <div class="az-in">
        <h2 class="az-titre">Ce qui est référencé ${esc(r.lieu)}</h2>
        <div class="az-dispos">${cartes}
        </div>
      </div>
    </section>

    <section class="az az-sombre">
      <div class="az-in">
        <h2 class="az-titre">Les aides nationales</h2>
        <div class="az-nat">${nat}</div>
      </div>
    </section>

    <section class="az az-claire az-zone-faq">
      <div class="az-in">
        <h2 class="az-titre">Questions fréquentes</h2>
        <div class="az-faq">
${faqHtml(items)}
        </div>
        <p class="az-sources">Informations relevées le ${DATE_RELEVE}, à confirmer auprès de chaque source avant toute demande.</p>
      </div>
    </section>

    <section class="az az-blanche">
      <div class="az-in">
        <h2 class="az-titre">Les autres régions</h2>
        <div class="az-regions">${listeRegions(r.slug)}</div>
        <div class="az-actions">${actionsDevis}</div>
      </div>
    </section>
` + pied('  <script src="/assets/js/site.js" defer></script>\n');
}

fs.rmSync(SORTIE, { recursive: true, force: true });
fs.mkdirSync(SORTIE, { recursive: true });
fs.writeFileSync(path.join(SORTIE, 'index.html'), hub());
for (const r of REGIONS) {
  fs.mkdirSync(path.join(SORTIE, r.slug), { recursive: true });
  fs.writeFileSync(path.join(SORTIE, r.slug, 'index.html'), pageRegion(r));
}

// Plan du site : on ajoute le hub et les régions (une seule fois)
const plan = path.join(RACINE, 'sitemap.xml');
let xml = fs.readFileSync(plan, 'utf8').replace(/\s*<url><loc>https:\/\/studionovae\.org\/aide-creation-site-web\/[^<]*<\/loc><\/url>/g, '');
const urls = ['/aide-creation-site-web/', ...REGIONS.map((r) => `/aide-creation-site-web/${r.slug}/`)];
xml = xml.replace('</urlset>', urls.map((u) => `  <url><loc>${DOMAINE}${u}</loc></url>\n`).join('') + '</urlset>');
fs.writeFileSync(plan, xml);
console.log(`${REGIONS.length + 1} pages écrites dans public_html/aide-creation-site-web/ et plan du site mis à jour.`);
