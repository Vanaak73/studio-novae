// Données communes à toutes les pages : identité, adresses, liste des services.
const DOMAINE = 'https://studionovae.org';
const MAIL = 'contact@studionovae.org';
// Tous les boutons « Demander un devis » mènent à la page Contact (outil de devis) ; ceux des pages de service présélectionnent le service.
const DEVIS = '/contact';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Ordre = ordre des menus. `tuile` : image et texte de la carte de l'accueil.
const SERVICES = [
  { slug: 'site-vitrine', devis: 'un site vitrine', nom: 'Site vitrine', tuile: { img: 'vitrine-atelier-ceramique.jpg', texte: 'Un site clair et rapide pour présenter votre activité, avec en option un espace pour le modifier vous-même.' } },
  { slug: 'outil-metier', devis: 'un outil sur mesure', nom: 'Outil sur mesure', tuile: { img: 'outil-poste-travail-bureau.jpg', texte: 'Un espace de travail privé, conçu pour votre métier, où votre équipe retrouve tout au même endroit.' } },
  { slug: 'automatisation-ia', devis: 'une automatisation', nom: 'Automatisation & IA', tuile: { img: 'automatisation-datacenter.jpg', texte: 'Vos outils connectés entre eux et des assistants IA qui connaissent votre entreprise.' } },
  { slug: 'boutique-en-ligne', devis: 'une boutique en ligne', nom: 'Boutique en ligne (e-commerce)', tuile: { img: 'boutique-ecommerce-smartphone.jpg', texte: 'Un catalogue, un paiement sécurisé et une gestion simple de vos commandes.' } },
  { slug: 'video-ugc', devis: 'une vidéo UGC', nom: 'Vidéo UGC (promotion)', tuile: { img: 'ugc-telephone-trepied-cafe.jpg', texte: 'Le bouche-à-oreille en vidéo : des vidéos façon avis client pour promouvoir votre activité.' } },
  { slug: 'community-management', devis: 'du community management', nom: 'Community management', tuile: { img: 'reseaux-sociaux-telephone.jpg', texte: 'Une présence régulière sur vos réseaux sociaux, animée pour vous.' } },
];

const urlService = (slug) => `/services/${slug}`;
const devisPour = (nom) => { const s = SERVICES.find((x) => x.nom === nom); return s ? `${DEVIS}?service=${s.slug}` : DEVIS; };

// Section « Des projets déjà en ligne » (accueil) et lien « Réalisations » du menu : masqués tant que la liste est courte. Passer à true pour les réafficher.
const REALISATIONS_VISIBLES = false;

// Sites réalisés : listés dans la section Réalisations (si affichée) et toujours dans le pied de page, liens suivis par les moteurs de recherche.
const PROJETS = [
  { nom: 'Producteurs Locaux', detail: 'Annuaire et carte du circuit court, France', url: 'https://producteurslocaux.org', logo: 'icone-producteurslocaux.webp' },
  { nom: 'Fairy Nail Art', detail: 'Prothésiste ongulaire, Chambéry', url: 'https://fairynailart.fr', logo: 'icone-fairynailart.webp' },
  { nom: 'Khrua Siam', detail: 'Traiteur thaïlandais, Chambéry', url: 'https://khrua-siam.fr', logo: 'icone-khrua-siam.webp' },
  { nom: 'Roof Monkeys', detail: 'Couvreur-zingueur, Morlaix', url: 'https://roofmonkeys.fr', logo: 'icone-roofmonkeys.webp' },
];

module.exports = { DOMAINE, MAIL, DEVIS, esc, SERVICES, urlService, devisPour, REALISATIONS_VISIBLES, PROJETS };
