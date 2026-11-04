// Page Contact et devis : copie de la page « Contact » de la maquette bleu nuit (.superpowers/maquettes/design-site-v2-bleu-nuit).
// Deux onglets (devis en trois temps avec récapitulatif en direct, question libre). L'envoi passe par POST /api/contact (src/api-contact.js) :
// la demande est enregistrée sur le serveur et envoyée par e-mail. La logique de la page est dans public_html/assets/js/contact.js.
const { DOMAINE, MAIL, SERVICES, esc } = require('../site');
const { page } = require('../layout');

// Libellés courts des choix de service (valeur envoyée dans le message), dans l'ordre des menus.
const LIBELLES = {
  'site-vitrine': 'Site vitrine',
  'outil-metier': 'Outil sur mesure',
  'automatisation-ia': 'Automatisation et IA',
  'boutique-en-ligne': 'Boutique en ligne',
  'video-ugc': 'Vidéo UGC',
  'community-management': 'Community management',
};

const URL_CONTACT = '/contact.html';
const TITRE = 'Contact et devis | Studio Novae';
const DESCRIPTION = 'Demandez un devis détaillé ou posez une question à Studio Novae : site vitrine, outil sur mesure, boutique en ligne, automatisation IA.';

function pageContact() {
  const choix = SERVICES.map((s, i) => `                      <input type="checkbox" id="s${i + 1}" name="service" value="${esc(LIBELLES[s.slug])}" data-slug="${s.slug}"><label for="s${i + 1}">${esc(LIBELLES[s.slug])}</label>`).join('\n');

  const main = `    <div class="mq">
      <section class="section" style="padding-bottom:clamp(40px,6vw,72px)">
        <div class="c">
          <div class="tete-section" style="margin-bottom:28px">
            <h1 class="page-contact-titre">Contact</h1>
            <p class="chapo">Un projet à chiffrer ou une question à poser : choisissez ce qui vous convient.</p>
          </div>
          <div class="onglets" role="tablist" aria-label="Type de demande">
            <button type="button" role="tab" id="t-devis" aria-selected="true" aria-controls="v-devis">Demander un devis</button>
            <button type="button" role="tab" id="t-question" aria-selected="false" aria-controls="v-question">Poser une question</button>
          </div>

          <div class="duo-contact">
            <div>
              <div class="panneau carte" id="v-devis" role="tabpanel" aria-labelledby="t-devis">
                <form id="form-devis" novalidate>
                  <input type="text" name="site" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" />
                  <div class="bloc-form">
                    <h3><b>1</b>Votre projet</h3>
                    <p class="groupe-titre">Choisissez un ou plusieurs services.</p>
                    <div class="choix" id="services-choix">
${choix}
                    </div>
                  </div>
                  <div class="bloc-form">
                    <h3><b>2</b>Votre besoin</h3>
                    <label class="champ">Décrivez votre activité et ce que vous attendez
                      <textarea id="besoin" placeholder="Exemple : je suis couvreur à Morlaix et je souhaite un site qui présente mes réalisations."></textarea></label>
                    <label class="champ">Quand souhaitez-vous démarrer ?
                      <select id="delai"><option value="">Choisir</option><option>Dès que possible</option><option>Dans les 3 mois</option><option>Dans l'année</option><option>Je me renseigne</option></select></label>
                    <label class="case"><input type="checkbox" id="aide"> <span>Je souhaite connaître les aides qui peuvent financer ce projet. <a class="lien" href="/aide-creation-site-web/">Voir les aides</a></span></label>
                  </div>
                  <div class="bloc-form">
                    <h3><b>3</b>Vos coordonnées</h3>
                    <div class="deux">
                      <label class="champ">Nom<input id="nom" type="text" autocomplete="name" required /></label>
                      <label class="champ">E-mail<input id="mail" type="email" autocomplete="email" required /></label>
                    </div>
                    <label class="champ">Téléphone (facultatif)<input id="tel" type="tel" autocomplete="tel" /></label>
                    <p class="msg-form erreur" id="erreur-devis" role="alert" hidden></p>
                    <p class="msg-form ok" id="ok-devis" role="status" hidden></p>
                    <div class="actions" style="margin-top:6px"><button class="btn btn-devis" type="submit">Envoyer ma demande de devis</button></div>
                  </div>
                </form>
              </div>

              <div class="panneau carte" id="v-question" role="tabpanel" aria-labelledby="t-question" hidden>
                <form id="form-question" style="display:grid;gap:14px" novalidate>
                  <input type="text" name="site" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" />
                  <div class="deux">
                    <label class="champ">Nom<input id="q-nom" type="text" autocomplete="name" required /></label>
                    <label class="champ">E-mail<input id="q-mail" type="email" autocomplete="email" required /></label>
                  </div>
                  <label class="champ">Votre message<textarea id="q-message" required></textarea></label>
                  <p class="msg-form erreur" id="erreur-question" role="alert" hidden></p>
                  <p class="msg-form ok" id="ok-question" role="status" hidden></p>
                  <div class="actions" style="margin:0"><button class="btn btn-contour" type="submit">Envoyer ma question</button></div>
                </form>
              </div>
            </div>

            <aside class="resume" aria-live="polite" aria-label="Récapitulatif de votre demande">
              <h3>Votre demande</h3>
              <dl>
                <div><dt>Services</dt><dd id="r-services" class="vide">À choisir</dd></div>
                <div><dt>Besoin</dt><dd id="r-besoin" class="vide">À décrire</dd></div>
                <div><dt>Démarrage</dt><dd id="r-delai" class="vide">À préciser</dd></div>
                <div><dt>Aides</dt><dd id="r-aide" class="vide">Facultatif</dd></div>
              </dl>
              <hr />
              <p class="petit" style="color:rgba(255,255,255,.72)">Le devis est détaillé par ligne : conception, hébergement, prise en main. Il peut accompagner un dossier d'aide.</p>
              <p class="petit" style="color:rgba(255,255,255,.72)">Écrire directement : <a class="lien" href="mailto:${MAIL}">${MAIL}</a></p>
            </aside>
          </div>
        </div>
      </section>
    </div>`;

  return page({
    meta: {
      titre: TITRE, description: DESCRIPTION, url: URL_CONTACT, ogImage: 'accueil.jpg', feuilles: ['maquette.css', 'contact.css'],
      jsonld: { '@context': 'https://schema.org', '@type': 'ContactPage', name: TITRE, url: DOMAINE + URL_CONTACT, isPartOf: { '@type': 'WebSite', name: 'Studio Novae', url: `${DOMAINE}/` }, about: { '@type': 'Organization', name: 'Studio Novae', email: MAIL } },
    },
    classeCorps: 'page-contact',
    main,
    scripts: '  <script src="/assets/js/site.js" defer></script>\n  <script src="/assets/js/contact.js" defer></script>',
  });
}

module.exports = { pageContact, URL_CONTACT, LIBELLES };
