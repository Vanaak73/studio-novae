// Gabarit commun : <head> (SEO, partage), en-tête, pied de page. Chaque page fournit son contenu <main>.
const { DOMAINE, MAIL, DEVIS, esc, SERVICES, urlService } = require('./site');

const ICONE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230a1230'/%3E%3Cpath d='M18 48V16l28 32V16' fill='none' stroke='%23a8dc5a' stroke-width='6' stroke-linejoin='round'/%3E%3C/svg%3E";
const POLICES = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@300;500;700&display=swap';

// L'accueil utilise aussi Space Grotesk en graisse 400 (titres des tuiles), comme la maquette.
const POLICES_ACCUEIL = POLICES.replace('Space+Grotesk:wght@300;500;700', 'Space+Grotesk:wght@300;400;500;700');

const liensServices = () => SERVICES.map((s) => `<a href="${urlService(s.slug)}">${esc(s.nom)}</a>`);

function tete({ titre, description, url, jsonld, ogImage, couleur = '#0a1230', feuilles = [], polices = POLICES }) {
  const image = ogImage ? [
    `  <meta property="og:image" content="${DOMAINE}/assets/images/og/${ogImage}" />`,
    '  <meta property="og:image:width" content="1200" />',
    '  <meta property="og:image:height" content="630" />',
    `  <meta property="og:image:alt" content="${esc(titre)}" />`,
  ] : [];
  const twitterImage = ogImage ? [`  <meta name="twitter:image" content="${DOMAINE}/assets/images/og/${ogImage}" />`] : [];
  return [
    '<!DOCTYPE html>',
    '<html lang="fr">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${esc(titre)}</title>`,
    `  <meta name="description" content="${esc(description)}" />`,
    `  <link rel="canonical" href="${DOMAINE}${url}" />`,
    `  <meta name="theme-color" content="${couleur}" />`,
    `  <link rel="icon" href="${ICONE}" />`,
    '  <meta property="og:site_name" content="Studio Novae" />',
    '  <meta property="og:locale" content="fr_FR" />',
    '  <meta property="og:type" content="website" />',
    `  <meta property="og:title" content="${esc(titre)}" />`,
    `  <meta property="og:description" content="${esc(description)}" />`,
    `  <meta property="og:url" content="${DOMAINE}${url}" />`,
    ...image,
    `  <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />`,
    `  <meta name="twitter:title" content="${esc(titre)}" />`,
    `  <meta name="twitter:description" content="${esc(description)}" />`,
    ...twitterImage,
    `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>`,
    '  <link rel="stylesheet" href="/assets/css/style.css" />',
    ...feuilles.map((f) => `  <link rel="stylesheet" href="/assets/css/${f}" />`),
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    `  <link href="${polices}" rel="stylesheet" />`,
    '</head>',
  ].join('\n');
}

const entete = () => `  <header class="site-header">
    <a class="logo" href="/" aria-label="Studio Novae, accueil">STUDIO <span>·</span> NOVAE</a>
    <nav>
      <div class="has-menu">
        <a class="menu-trigger" href="/#services" aria-haspopup="true">Services</a>
        <div class="submenu">
          ${liensServices().join('\n          ')}
        </div>
      </div>
      <a href="/#realisations">Réalisations</a>
      <a href="/#methode">Méthode</a>
      <a href="/a-propos.html">À propos</a>
      <a class="nav-contact" href="mailto:${MAIL}">Nous contacter</a>
      <a class="btn-devis nav-devis" href="${DEVIS}">Demander un devis</a>
    </nav>
  </header>`;

const pied = () => `  <footer>
    <div>
      <a class="logo" href="/">STUDIO <span>·</span> NOVAE</a>
      <p>Développement web et automatisation IA, depuis la France.</p>
    </div>
    <div class="footer-links">
      ${[...liensServices(), '<a href="/a-propos.html">À propos</a>', '<a href="/aide-creation-site-web/">Aides à la création de site</a>', `<a href="mailto:${MAIL}">Contact</a>`].join('\n      ')}
    </div>
    <div class="footer-copy"><span>© 2026 Studio Novae</span><span>Images : <a href="https://www.magnific.com/" target="_blank" rel="noopener">Designed by Magnific</a></span><a href="#top">Retour en haut ↑</a></div>
  </footer>`;

// Assemble une page complète. `scripts` : balises <script> placées avant </body>.
function page({ meta, classeCorps, main, scripts }) {
  const corps = classeCorps ? `<body class="${classeCorps}">` : '<body>';
  const js = scripts || '  <script src="/assets/js/site.js" defer></script>';
  return `${tete(meta)}\n${corps}\n\n${entete()}\n\n  <main id="top">\n${main}\n  </main>\n\n${pied()}\n\n${js}\n</body>\n</html>\n`;
}

module.exports = { page, POLICES_ACCUEIL };
