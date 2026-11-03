// Section « Aides à la création de site web » : le hub (parcours en 3 questions + FAQ) et une page par région.
const { DOMAINE, MAIL, DEVIS, esc } = require('../site');
const { page } = require('../layout');
const REGIONS = require('./donnees-regions.js');

const DATE_RELEVE = '2 novembre 2026';
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
  const main = `
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
`;
  return page({
    meta: { titre, description, url: '/aide-creation-site-web/', jsonld: ld, couleur: '#eef1f9', feuilles: ['aides.css'] },
    classeCorps: 'aides',
    main,
    scripts: `  <script>window.AIDES = ${JSON.stringify(donnees)};</script>
  <script src="/assets/js/aides.js" defer></script>
  <script src="/assets/js/site.js" defer></script>`,
  });
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
  const main = `
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
`;
  return page({ meta: { titre, description, url, jsonld: ld, couleur: '#eef1f9', feuilles: ['aides.css'] }, classeCorps: 'aides', main });
}

// Retourne [{ url, html }] : le hub puis chaque région.
function pagesAides() {
  return [
    { url: '/aide-creation-site-web/', html: hub() },
    ...REGIONS.map((r) => ({ url: `/aide-creation-site-web/${r.slug}/`, html: pageRegion(r) })),
  ];
}

module.exports = { pagesAides, REGIONS };
