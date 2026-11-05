// Page d'administration (/admin/) : connexion, puis conversations. Document autonome (feuille admin.css, script admin.js), jamais indexé.
// Le contenu des conversations arrive par l'API et s'affiche côté navigateur via textContent ; cette page ne contient aucune donnée de client.
const { esc } = require('../site');

const POLICES = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;700&display=swap';

const ONGLETS = [
  { nom: 'Conversations', actif: true },
  { nom: 'Utilisateurs', bientot: true },
  { nom: 'Autres outils', bientot: true },
];

const tete = (csrf) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Administration · Studio Novae</title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <meta name="theme-color" content="#0a1230" />
  ${csrf ? `<meta name="csrf" content="${esc(csrf)}" />` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="${POLICES}" />
  <link rel="stylesheet" href="/assets/css/admin.css" />
</head>`;

const entete = (connecte, email) => `  <header class="adm-entete">
    <a class="logo" href="/" aria-label="Studio Novae, accueil">STUDIO <span>·</span> NOVAE</a>
    <nav class="adm-nav" aria-label="Navigation">
      <a href="/">Site</a>
      <a href="/admin/" aria-current="page">Administration</a>
      ${connecte ? `<span class="adm-moi">${esc(email || '')} · admin</span><button type="button" id="deconnexion" class="adm-lien">Se déconnecter</button>` : ''}
    </nav>
  </header>`;

const connexion = () => `  <main class="adm-connexion">
    <form id="connexion" class="adm-carte" autocomplete="on" novalidate>
      <span class="adm-kick">Page d'administration</span>
      <h1>Connexion</h1>
      <label>Adresse e-mail<input type="email" name="email" autocomplete="username" required /></label>
      <label>Mot de passe<input type="password" name="mdp" autocomplete="current-password" required /></label>
      <p class="adm-erreur" id="erreur-connexion" role="alert" hidden></p>
      <button class="adm-bouton" type="submit">Se connecter</button>
    </form>
  </main>`;

const conversations = () => `  <div class="adm-bandeau">
    <div class="adm-bandeau-contenu">
      <span class="adm-kick">Page d'administration</span>
      <h1>Administration</h1>
      <div class="adm-onglets" role="tablist" aria-label="Outils d'administration">
        ${ONGLETS.map((o) => `<span role="tab"${o.actif ? ' aria-selected="true"' : ' aria-disabled="true"'} class="${o.actif ? 'actif' : 'bientot'}">${esc(o.nom)}${o.bientot ? '<em>bientôt</em>' : ''}</span>`).join('\n        ')}
      </div>
    </div>
  </div>
  <main class="adm-corps" id="vue">
    <section class="adm-liste" aria-label="Conversations">
      <div class="adm-liste-tete">
        <h2>Conversations</h2>
        <button type="button" class="adm-bouton adm-petit" id="nouveau-message">Nouveau message</button>
      </div>
      <div class="adm-filtres" role="group" aria-label="Filtrer les conversations">
        <button type="button" class="adm-pastille actif" data-filtre="toutes">Toutes</button>
        <button type="button" class="adm-pastille" data-filtre="non_lues">Non lues<span id="compte-non-lues"></span></button>
        <button type="button" class="adm-pastille" data-filtre="devis">Devis</button>
        <label class="adm-archivees"><input type="checkbox" id="archivees" /> Archivées</label>
      </div>
      <div id="liste-conversations"></div>
    </section>
    <section class="adm-fil" aria-label="Conversation" id="fil">
      <div class="adm-vide" id="fil-vide">Choisissez une conversation dans la liste.</div>
    </section>
  </main>`;

// connecte : session valide ; csrf : jeton de la session (fourni au script par une balise meta) ; email : adresse de l'administrateur connecté.
function pageAdmin({ connecte = false, csrf = '', email = '' } = {}) {
  return [
    tete(connecte ? csrf : ''),
    '<body class="adm">',
    entete(connecte, email),
    connecte ? conversations() : connexion(),
    `  <script src="/assets/js/admin.js" defer></script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

module.exports = { pageAdmin };
