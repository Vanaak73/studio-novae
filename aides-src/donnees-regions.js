// Aides à la création de site web : une entrée par région (recherches du 2 novembre 2026).
// niveau : « officiel » = page ou document de la Région ; « annuaire » = fiche d'un annuaire d'aides publiques ; « article » = presse ou blog.
// Toutes les informations se confirment auprès de la source avant toute demande.
module.exports = [
  { slug: 'auvergne-rhone-alpes', nom: 'Auvergne-Rhône-Alpes', lieu: 'en Auvergne-Rhône-Alpes',
    resume: "Atouts Numériques est un accompagnement financé à 100 % par la Région et l'Union européenne, pour les entreprises de moins de 50 salariés.",
    beneficiaires: "Les entreprises de moins de 50 salariés. L'entreprise dépose elle-même sa candidature : un diagnostic de maturité numérique en ligne sur le portail Campus Région du numérique ouvre le dossier.",
    contact: "Le portail Campus Région du numérique, puis la CCI ou la CMA de votre territoire.",
    dispositifs: [
      { nom: 'Atouts Numériques', type: 'Accompagnement', montant: 'Financé à 100 %', points: ['Financement Région et Union européenne (FEDER)', 'Entreprises de moins de 50 salariés', 'Diagnostic de maturité numérique en ligne, suivi d\'un accompagnement personnalisé'], niveau: 'annuaire', source: { titre: 'Fiche Atouts Numériques (les-aides.fr)', url: 'https://les-aides.fr/aide/dicv3w/region-auvergne-rhone-alpes/mettre-en-oeuvre-un-projet-numerique-avec-atouts-numeriques.html' } }
    ] },
  { slug: 'bourgogne-franche-comte', nom: 'Bourgogne-Franche-Comté', lieu: 'en Bourgogne-Franche-Comté',
    resume: "DIGIT PASS finance un accompagnement individuel au numérique (e-commerce, relation client, données, logiciels) ; la brochure de la Région date de 2021 et ses conditions actuelles se confirment auprès de la Région.",
    beneficiaires: "Les conditions en vigueur se confirment auprès de la Région : la brochure disponible date de 2021.",
    contact: "L'équipe entreprises de la Région (entreprises@bourgognefranchecomte.fr), la CCI ou la CMA.",
    dispositifs: [
      { nom: 'DIGIT PASS', type: 'Accompagnement', montant: 'À confirmer', points: ['Accompagnement individuel : e-commerce, relation client, données, logiciels', 'La brochure de 2021 cadre les dépenses retenues', 'Ouverture en 2026 à confirmer'], niveau: 'officiel', source: { titre: 'Brochure de la Région (2021)', url: 'https://bourgognefranchecomte.fr/file-download?fid=9865' } },
      { nom: 'Avance remboursable croissance des TPE', type: 'Avance remboursable', montant: 'À confirmer', points: ['Entreprises immatriculées depuis plus de 3 ans', 'Projet de croissance, numérique inclus'], niveau: 'annuaire', source: { titre: 'Fiche (les-aides.fr)', url: 'https://les-aides.fr/e_cci/aide/RpMf3w/region-bourgogne-franche-comte/avance-remboursable-croissance-des-tpe.html' } }
    ] },
  { slug: 'bretagne', nom: 'Bretagne', lieu: 'en Bretagne',
    resume: "Un annuaire référence en Bretagne une subvention de numérisation des TPE de proximité, jusqu'à 7 500 € (30 % des dépenses) ; ses conditions actuelles se confirment auprès de la Région.",
    beneficiaires: "Le chèque numérique référencé s'adresse aux petits commerces de moins de 300 m². Les conditions 2026 se confirment auprès de la Région.",
    contact: "La Région Bretagne, la CCI ou la CMA.",
    dispositifs: [
      { nom: 'Subvention de numérisation des TPE de proximité', type: 'Subvention', montant: "Jusqu'à 7 500 € (30 % des dépenses)", points: ['Date de validité à confirmer', 'Décision en 1 à 3 mois selon la fiche'], niveau: 'annuaire', source: { titre: 'Aides à la transition numérique en Bretagne (Infogreffe)', url: 'https://mesaidespubliques.infogreffe.fr/aides/territoires/region-bretagne/transition-numerique' } },
      { nom: 'Chèque numérique Bretagne', type: 'Chèque', montant: 'À confirmer', points: ['Petits commerces de moins de 300 m²', 'Financement possible d\'un prestataire pour un nouveau site (source ancienne)'], niveau: 'article', source: { titre: 'Aides à la transition numérique en Bretagne (Infogreffe)', url: 'https://mesaidespubliques.infogreffe.fr/aides/projets/transition-numerique/region-bretagne' } }
    ] },
  { slug: 'centre-val-de-loire', nom: 'Centre-Val de Loire', lieu: 'en Centre-Val de Loire',
    resume: "Le dispositif CAP TN soutient la transformation numérique (conseil et investissement), avec une aide régionale plafonnée à 20 000 €.",
    beneficiaires: "Petites entreprises de proximité pour CAP Économie de Proximité ; demande auprès du Conseil régional pour CAP TN. Fiches les plus récentes : décembre 2025 et octobre 2024.",
    contact: "Le Conseil régional Centre-Val de Loire, la CCI ou la CMA.",
    dispositifs: [
      { nom: 'CAP TN (Transformation numérique)', type: 'Subvention', montant: "Jusqu'à 20 000 € d'aide régionale", points: ['Volet conseil : recours à un prestataire externe', 'Volet investissement', 'Fiche mise à jour le 3 décembre 2025'], niveau: 'annuaire', source: { titre: 'Fiche CAP TN (les-aides.fr)', url: 'https://les-aides.fr/aide/aZZf3w/region-centre-val-de-loire/cap-tn-transformation-numerique.html' } },
      { nom: 'CAP Économie de Proximité', type: 'Subvention', montant: "Jusqu'à 20 000 €", points: ['Conseil externe issu d\'un diagnostic numérique (site internet, e-commerce, cybersécurité)', 'Petites entreprises de proximité', 'Fiche la plus récente : octobre 2024'], niveau: 'annuaire', source: { titre: 'Fiche CAP Économie de Proximité (les-aides.fr)', url: 'https://les-aides.fr/cci.rochefort/aide/cRNP3w/region-centre-val-de-loire/cap-economie-de-proximite.html' } }
    ] },
  { slug: 'corse', nom: 'Corse', lieu: 'en Corse',
    resume: "La Collectivité de Corse et l'ADEC soutiennent la modernisation et la transition numérique des TPE ; l'appel à projets 2026 a clôturé ses candidatures le 15 juillet 2026.",
    beneficiaires: "Le texte de l'appel à projets cité date de l'édition 2024 : les conditions de la prochaine édition se confirment auprès de l'ADEC.",
    contact: "L'ADEC (Agence de Développement Économique de la Corse), la CMA ou la CCI de Corse.",
    dispositifs: [
      { nom: "Appel à projets ADEC (économie productive de proximité)", type: 'Appel à projets', montant: "Jusqu'à 50 000 €", points: ["L'accessibilité physique et numérique des entreprises figure parmi les dépenses visées", 'Candidatures closes le 15 juillet 2026 selon la source', 'Prochaine édition à suivre'], niveau: 'annuaire', source: { titre: "Appel à projets (Infogreffe)", url: 'https://mesaidespubliques.infogreffe.fr/aides/appel-projets-economie-productive-proximite-ruralite' } },
      { nom: 'Aide à la modernisation et à la transition numérique', type: 'Subvention', montant: "Jusqu'à 50 % des coûts", points: ['TPE et projets collaboratifs', 'Source secondaire à confirmer'], niveau: 'article', source: { titre: 'Aides à la transition numérique en Corse (Infogreffe)', url: 'https://mesaidespubliques.infogreffe.fr/aides/territoires/region-corse/transition-numerique' } }
    ] },
  { slug: 'grand-est', nom: 'Grand Est', lieu: 'dans le Grand Est',
    resume: "Grand Est Transformation Digitale a proposé un chèque numérique aux entreprises de moins de 20 salariés (fiche de 2022) ; son ouverture actuelle se confirme auprès de la Région.",
    beneficiaires: "Entreprises de moins de 20 salariés, avec un diagnostic de maturité digitale préalable, demande sur la plateforme de la Région.",
    contact: "La plateforme de téléservice de la Région Grand Est, la CCI ou la CMA.",
    dispositifs: [
      { nom: 'Grand Est Transformation Digitale', type: 'Chèque numérique', montant: "6 000 € (parcours individuel, selon une source secondaire)", points: ['Conseil et solutions digitales, sites marchands compris', 'Diagnostic de maturité préalable', 'Fiche de février 2022 : ouverture à confirmer'], niveau: 'annuaire', source: { titre: 'Fiche (les-aides.fr)', url: 'https://les-aides.fr/aide/ZYd_3w/region-grand-est/grand-est-transformation-digitale.html' } }
    ] },
  { slug: 'hauts-de-france', nom: 'Hauts-de-France', lieu: 'dans les Hauts-de-France',
    resume: "L'INAC finance 40 % des investissements numériques des artisans et commerçants (de 3 000 à 30 000 € HT), et le Booster TPE Numérique de la CCI propose un accompagnement jusqu'au 31 décembre 2026.",
    beneficiaires: "INAC : artisans et commerçants. Booster TPE Numérique : entreprises du territoire, avec un nombre de places limité par entreprise.",
    contact: "La Région Hauts-de-France, la CCI ou la CMA de votre territoire.",
    dispositifs: [
      { nom: 'INAC', type: 'Subvention', montant: '1 200 à 12 000 € (40 % de 3 000 à 30 000 € HT)', points: ['Artisans et commerçants', 'Un site vitrine simple figure dans une fiche ancienne', 'Montant issu d\'un guide 2026 de prestataire : à confirmer'], niveau: 'article', source: { titre: 'Fiche INAC (les-aides.fr)', url: 'https://les-aides.fr/aide/WIBv3w/region-hauts-de-france.inac-soutien-aux-investissements-numeriques-des-artisans-commercants.pdf' } },
      { nom: 'Booster TPE – Numérique (CCI)', type: 'Accompagnement', montant: 'Prise en charge à confirmer', points: ['Mise en œuvre ou amélioration du site internet possible', "Jusqu'au 31/12/2026 (Région et FEDER)", 'Fiche de janvier 2026'], niveau: 'annuaire', source: { titre: 'Fiche Booster TPE (les-aides.fr)', url: 'https://les-aides.fr/aide/SFRP3w/cci-hauts-de-france/booster-tpe-numerique.html' } },
      { nom: 'ADEN', type: 'Subvention', montant: 'À confirmer', points: ['Digitalisation, site de vente en ligne compris', 'Ouverture en 2026 à confirmer'], niveau: 'annuaire', source: { titre: 'Fiche ADEN (les-aides.fr)', url: 'https://les-aides.fr/aide/cDKP3w/region-hauts-de-france.aden-aide-a-la-digitalisation-des-entreprises.pdf' } }
    ] },
  { slug: 'ile-de-france', nom: 'Île-de-France', lieu: 'en Île-de-France',
    resume: "Le chèque numérique pour un commerce connecté est clos, selon la page de la Région ; les dossiers déjà engagés devaient transmettre leurs factures avant le 30 juin 2026. PM'up soutient les projets des PME.",
    beneficiaires: "PM'up s'adresse aux PME, avec un plafond de 250 000 €.",
    contact: "La Région Île-de-France (aides.economiques@iledefrance.fr), la CCI ou la CMA.",
    dispositifs: [
      { nom: 'Chèque numérique pour un commerce connecté', type: 'Chèque', montant: 'Clos (150 à 1 500 € dans sa dernière version)', points: ['Page de la Région : dispositif clos', 'Échéance du 30/06/2026 pour les factures des dossiers déjà engagés'], niveau: 'officiel', source: { titre: 'Page de la Région Île-de-France', url: 'https://www.iledefrance.fr/cheque-numerique-pour-un-commerce-connecte' } },
      { nom: "PM'up", type: 'Subvention', montant: 'Plafond de 250 000 €', points: ['Destiné aux PME', 'Crédits en hausse selon le CESER (budget supplémentaire 2026)'], niveau: 'annuaire', source: { titre: "Dispositifs PM'up (les-aides.fr)", url: 'https://les-aides.fr/aide/cAd_3w/region-ile-de-france.pm-up-jeunes-pousses-industrielles.pdf' } }
    ] },
  { slug: 'normandie', nom: 'Normandie', lieu: 'en Normandie',
    resume: "Les dispositifs Impulsion de la Région et d'AD Normandie couvrent des projets numériques, dont la création d'un site e-commerce ; les règlements en vigueur se confirment auprès d'AD Normandie.",
    beneficiaires: "Impulsion Proximité vise les petites entreprises. Les fiches Impulsion Transition numérique (2023) et Impulsion Conseil (2022) se confirment auprès d'AD Normandie.",
    contact: "AD Normandie, la Région Normandie, la CCI ou la CMA.",
    dispositifs: [
      { nom: 'Impulsion Proximité', type: 'Subvention', montant: "Jusqu'à 50 000 € par projet", points: ["Projets éligibles : création d'un site e-commerce, click-and-collect, logiciels de vente en ligne", "Information issue d'un article de presse locale"], niveau: 'article', source: { titre: 'Article de presse (info.fr)', url: 'https://info.fr/louviers-20-boutiques-aidees-digitalisation-e-commerce-2026/' } },
      { nom: 'Impulsion Transition numérique', type: 'Subvention', montant: 'À confirmer', points: ['Fiche de janvier 2023', "Cumul avec d'autres aides de la Région encadré sur 6 mois pour les mêmes dépenses"], niveau: 'annuaire', source: { titre: 'Fiche (les-aides.fr)', url: 'https://les-aides.fr/aide/WWcPEowMDA4f/ad-normandie.impulsion-transition-numerique.pdf' } },
      { nom: 'Impulsion Conseil', type: 'Conseil', montant: 'À confirmer', points: ['Règlement de novembre 2022', 'Projets de croissance des TPE et PME'], niveau: 'officiel', source: { titre: 'Règlement AD Normandie (2022)', url: 'https://adnormandie.fr/wp-content/uploads/2022/11/Reglement-Impulsion-Conseil-CP-7.11.2022-VF.pdf' } }
    ] },
  { slug: 'nouvelle-aquitaine', nom: 'Nouvelle-Aquitaine', lieu: 'en Nouvelle-Aquitaine',
    resume: "Le parcours Défis numériques offre aux TPE de moins de 10 salariés jusqu'à 4 jours d'accompagnement gratuit, dont la création d'une première vitrine Google.",
    beneficiaires: "TPE de moins de 10 salariés pour les Défis numériques ; certaines aides de la Région demandent une immatriculation de plus de deux ans.",
    contact: "Le conseiller numérique de la CMA ou de la CCI de votre département.",
    dispositifs: [
      { nom: 'Défis numériques', type: 'Accompagnement', montant: "Jusqu'à 4 jours, gratuits", points: ['TPE de moins de 10 salariés', 'Défi 1 : créer une première vitrine Google', 'Contact : conseiller numérique CMA ou CCI du département'], niveau: 'annuaire', source: { titre: "Programme d'aide à la transformation numérique des TPE (Infogreffe)", url: 'https://mesaidespubliques.infogreffe.fr/aides/nouvelle-aquitaine-programme-aide-transformation-numerique-tpe' } },
      { nom: 'Aide à la transformation numérique', type: 'Subvention', montant: 'À confirmer', points: ['Projet de refonte globale, avec accompagnement préalable et diagnostic de cybersécurité', "Dépôt possible jusqu'au 31/12/2028 (Guide des aides de la Région)", 'Taux de 50 % cité par un blog : à confirmer'], niveau: 'officiel', source: { titre: 'Guide des aides de la Région Nouvelle-Aquitaine', url: 'https://les-aides.nouvelle-aquitaine.fr/' } }
    ] },
  { slug: 'occitanie', nom: 'Occitanie', lieu: 'en Occitanie',
    resume: "Une subvention de 5 000 à 10 000 € (50 % des dépenses) pour les TPE de moins de 20 salariés hors métropoles est référencée dans un annuaire ; le Pass Numérique est cité parmi les chèques régionaux.",
    beneficiaires: "TPE de moins de 20 salariés, hors métropoles, pour la subvention référencée. Date de validité à confirmer.",
    contact: "La Région Occitanie, la CCI ou la CMA. La fiche France Num sur les aides financières en Occitanie a été mise à jour le 25 mars 2026.",
    dispositifs: [
      { nom: 'Subvention TPE : environnement, énergie ou numérisation', type: 'Subvention', montant: '5 000 à 10 000 € (50 % des dépenses)', points: ['TPE de moins de 20 salariés hors métropoles', 'Date de validité à confirmer'], niveau: 'annuaire', source: { titre: 'Aides à la transition numérique en Occitanie (Infogreffe)', url: 'https://mesaidespubliques.infogreffe.fr/aides/territoires/region-occitanie/transition-numerique' } },
      { nom: 'Pass Numérique', type: 'Chèque', montant: 'À confirmer', points: ['Cité parmi les chèques régionaux', 'Conditions à confirmer auprès de la Région'], niveau: 'article', source: { titre: 'Fiche France Num : aides financières en Occitanie', url: 'https://www.francenum.gouv.fr/aides-financieres/guides-et-conseils-financiers/quelles-sont-les-aides-financieres-pour-la-12' } }
    ] },
  { slug: 'pays-de-la-loire', nom: 'Pays de la Loire', lieu: 'dans les Pays de la Loire',
    resume: "Pays de la Loire Investissement Numérique finance la conception d'un site vitrine pour les entreprises de moins de 50 salariés créées depuis plus de deux ans (30 %, de 1 500 à 15 000 €).",
    beneficiaires: "Moins de 50 salariés, chiffre d'affaires de 10 M€ au plus, activité marchande, plus de deux ans d'existence. La demande se dépose avant l'engagement des dépenses.",
    contact: "Le portail entreprisespaysdelaloire.fr ; contact historique : numerique@paysdelaloire.fr (source ancienne).",
    dispositifs: [
      { nom: 'Pays de la Loire Investissement Numérique (PDLIN)', type: 'Subvention', montant: '1 500 à 15 000 € (30 %, 40 % pour une solution éco-conçue)', points: ["Conception d'un site vitrine ou d'une plaquette, matériel informatique", 'Plus de deux ans d\'existence', 'Règlement le plus récent trouvé : mars 2023'], niveau: 'annuaire', source: { titre: 'Fiche PDLIN (les-aides.fr)', url: 'https://les-aides.fr/cci.troyes_et_aube/aide/Rnif3w/region-des-pays-de-la-loire/pays-de-la-loire-investissement-numerique-pdlin.html' } },
      { nom: 'Pays de la Loire Conseil', type: 'Conseil', montant: 'À confirmer', points: ['Cofinancement d\'un conseil externe', 'Demande déposée avant l\'engagement des dépenses'], niveau: 'annuaire', source: { titre: 'Fiche (les-aides.fr)', url: 'https://les-aides.fr/aide/RIhP3w/region-des-pays-de-la-loire/pays-de-la-loire-conseil.html' } }
    ] },
  { slug: 'provence-alpes-cote-d-azur', nom: "Provence-Alpes-Côte d'Azur", lieu: "en Provence-Alpes-Côte d'Azur",
    resume: "La Région Sud propose Mon Prêt TPE, un prêt à taux zéro pour l'investissement des petites entreprises ; une subvention dédiée au site web se confirme auprès de la Région.",
    beneficiaires: "Mon Prêt TPE : fiche mise à jour le 23 mars 2026. Les conditions d'une éventuelle subvention numérique se confirment auprès de la Région.",
    contact: "La Région Sud, la CCI ou la CMA ; France Num recense les aides par région.",
    dispositifs: [
      { nom: 'Mon Prêt TPE', type: 'Prêt', montant: 'Prêt à taux zéro', points: ['Trésorerie et investissement', 'Fiche mise à jour le 23 mars 2026'], niveau: 'annuaire', source: { titre: 'Fiche Mon Prêt TPE (les-aides.fr)', url: 'https://les-aides.fr/aide/cXRf3w/region-sud/mon-pret-tpe.html' } }
    ] },
  { slug: 'outre-mer', nom: 'Outre-mer', lieu: 'en Outre-mer',
    resume: "La Réunion propose un chèque numérique pour les petites structures et un accompagnement de la transition numérique ; la Martinique soutient les entreprises du numérique. Les autres territoires se confirment auprès de leur collectivité.",
    beneficiaires: "Les dispositifs varient d'un territoire à l'autre : Guadeloupe, Guyane et Mayotte se confirment auprès de leur collectivité et de leur chambre consulaire.",
    contact: "La collectivité de votre territoire, la CCI ou la CMA.",
    dispositifs: [
      { nom: 'La Réunion : soutien des projets digitaux des petites structures (chèque numérique)', type: 'Chèque', montant: 'À confirmer', points: ['Région Réunion', 'Ouverture en 2026 à confirmer'], niveau: 'annuaire', source: { titre: 'Fiche (les-aides.fr)', url: 'https://les-aides.fr/aide/Zpk_3w/region-reunion.soutien-des-projets-digitaux-des-petites-structures-cheque-numerique.pdf' } },
      { nom: 'La Réunion : accompagnement de la transition numérique des entreprises', type: 'Accompagnement', montant: 'À confirmer', points: ['Fiche mise à jour le 2 octobre 2024'], niveau: 'annuaire', source: { titre: 'Fiche (les-aides.fr)', url: 'https://les-aides.fr/cci.rochefort/aide/ZyBf3w/region-reunion/accompagnement-de-la-transition-numerique-des-entreprises.html' } },
      { nom: "La Réunion : soutien à l'investissement des entreprises du secteur numérique (FEDER)", type: 'Subvention', montant: 'Selon le projet', points: ['Entreprises du secteur numérique', "Mobilisable jusqu'au 31 décembre 2027"], niveau: 'annuaire', source: { titre: 'Fiche (Infogreffe)', url: 'https://mesaidespubliques.infogreffe.fr/aides/reunion-europe-soutien-a-investissement-materiel-entreprises-secteur-numerique' } },
      { nom: "Martinique : aide à l'accélération des entreprises numériques", type: 'Accompagnement', montant: 'À confirmer', points: ['Entreprises du secteur numérique'], niveau: 'article', source: { titre: 'Fiche (subventions.fr)', url: 'https://subventions.fr/aide/aide-a-lacceleration-des-entreprises-numeriques-en-martinique/' } }
    ] }
];
