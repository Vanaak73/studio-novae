// Page d'accueil : héros, services, méthode, aides, réalisations, appel final. Mise en page copiée de la maquette bleu nuit (public_html/assets/css/maquette.css).
const { DOMAINE, MAIL, DEVIS, esc, SERVICES, urlService } = require('../site');
const { page, POLICES_ACCUEIL } = require('../layout');

const TITRE = 'Studio Novae — Marketing digital et automatisation IA';
const DESCRIPTION = 'Studio Novae conçoit des sites vitrines, outils sur mesure, boutiques en ligne et automatisations IA pour les petites entreprises.';

const METHODE = [
  ['Audit', 'On regarde comment vos équipes travaillent vraiment, et où se trouvent les gains de temps.'],
  ['Prototype', 'Une première version fonctionnelle, testée sur un cas réel avant tout engagement plus large.'],
  ['Déploiement', "L'automatisation s'installe dans vos outils existants, pour que les équipes gardent leurs repères."],
  ['Suivi', "On reste disponible pour ajuster et faire évoluer, afin que le résultat dure dans le temps."],
];

const PROJETS = [
  { nom: 'Producteurs Locaux', detail: 'Annuaire et carte du circuit court, France', url: 'https://producteurslocaux.org', logo: 'logo-producteurslocaux.jpg' },
  { nom: 'Fairy Nail Art', detail: 'Prothésiste ongulaire, Chambéry', url: 'https://fairynailart.fr', logo: 'logo-fairynailart.jpg' },
  { nom: 'Khrua Siam', detail: 'Traiteur thaïlandais, Chambéry', url: 'https://khrua-siam.fr', logo: 'logo-khrua-siam.jpg' },
  { nom: 'Roof Monkeys', detail: 'Couvreur-zingueur, Morlaix', url: 'https://roofmonkeys.fr', logo: 'logo-roofmonkeys.jpg' },
];

// « (e-commerce) » reste sur une seule ligne : tiret insécable, enveloppe sans coupure.
const nomTuile = (nom) => esc(nom).replace('(e-commerce)', '<span style="white-space:nowrap">(e&#8209;commerce)</span>');

const tuile = (s) => `        <a class="tuile" href="${urlService(s.slug)}" style="background-image:url('/assets/images/${s.tuile.img}')"><div><h3>${nomTuile(s.nom)}</h3><p>${esc(s.tuile.texte)}</p></div></a>`;

const etape = ([nom, texte]) => `        <div class="etape"><h3>${esc(nom)}</h3><p>${esc(texte)}</p></div>`;

const projet = (p) => `        <a class="projet" href="${p.url}" target="_blank" rel="noopener"><img src="/assets/images/realisations/${p.logo}" alt="" /><strong>${esc(p.nom)}</strong><span>${esc(p.detail)}</span></a>`;

function pageAccueil() {
  const main = `    <section class="hero">
      <div class="hero-bg parallax-layer" style="--img:url('/assets/images/hero-oeil-numerique.jpg');background-position:58% 45%"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <p class="eyebrow-pill">Développement web & automatisation</p>
        <h1>Des outils qui travaillent<br /><em>pour vous.</em></h1>
        <div class="hero-bottom">
          <p class="hero-intro">Studio Novae conçoit des sites, des outils et des automatisations faits pour votre quotidien.</p>
          <div class="hero-actions"><a class="btn-devis" href="${DEVIS}">Demander un devis</a></div>
        </div>
      </div>
    </section>

    <div class="mq">
      <section class="section" id="services">
        <div class="lien-offres"><a href="#offres">Voir les services <span>↓</span></a></div>
        <div class="zone-tuiles">
          <div class="tete-section">
            <h2>Six façons de faire avancer votre activité</h2>
            <p class="chapo">Chaque projet démarre par une conversation sur votre activité et se termine par une mise en ligne que vous savez utiliser.</p>
          </div>
          <div class="tuiles" id="offres">
${SERVICES.map(tuile).join('\n')}
          </div>
        </div>
      </section>

      <section class="section blanc" id="methode">
        <div class="c">
          <div class="tete-section"><h2>Quatre étapes, du premier échange au suivi</h2></div>
          <div class="etapes">
${METHODE.map(etape).join('\n')}
          </div>
        </div>
      </section>

      <section class="section" id="aides">
        <div class="c">
          <div class="aides">
            <div class="texte">
              <h2>Des aides publiques pour financer votre site web</h2>
              <p class="chapo" style="font-size:1.1rem">L'État, les régions et les collectivités soutiennent le numérique des entreprises. Trois questions suffisent pour trouver celles de votre région.</p>
              <div class="actions" style="margin-top:6px"><a class="btn btn-contour" href="/aide-creation-site-web/">Trouver les aides de ma région</a></div>
            </div>
            <img src="/assets/images/aides-echange.jpg" alt="Deux personnes échangent autour d'une table de travail" loading="lazy" />
          </div>
        </div>
      </section>

      <section class="section blanc" id="realisations">
        <div class="c">
          <div class="tete-section"><h2>Des projets déjà en ligne</h2></div>
          <div class="projets">
${PROJETS.map(projet).join('\n')}
          </div>
        </div>
      </section>

      <section class="section sombre" id="contact">
        <div class="c appel">
          <div>
            <h2>Parlons de votre projet.</h2>
            <p class="chapo" style="margin-top:20px">Décrivez ce dont vous avez besoin : vous recevez un devis détaillé, avec des lignes séparées pour la conception, l'hébergement et la prise en main.</p>
          </div>
          <div class="droite">
            <div class="actions" style="margin:0"><a class="btn btn-devis" href="${DEVIS}">Demander un devis</a></div>
            <p class="mail">Une question ? Écrivez à <a class="lien" href="mailto:${MAIL}">${MAIL}</a></p>
          </div>
        </div>
      </section>
    </div>`;

  return page({
    meta: {
      titre: TITRE, description: DESCRIPTION, url: '/', ogImage: 'accueil.jpg', feuilles: ['maquette.css'], polices: POLICES_ACCUEIL,
      jsonld: { '@context': 'https://schema.org', '@type': 'Organization', name: 'Studio Novae', url: `${DOMAINE}/`, logo: `${DOMAINE}/assets/images/og/accueil.jpg`, email: MAIL, description: DESCRIPTION },
    },
    classeCorps: 'accueil',
    main,
  });
}

module.exports = { pageAccueil };
