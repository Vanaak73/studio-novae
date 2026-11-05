# Conversations par e-mail et page d'administration — conception

Date : 2026-11-05. Auteur du besoin : Rémi. Maquette validée : `.superpowers/brainstorm/600-1793869237/content/conversation-site-v3.html` (ordinateur : liste à gauche, conversation à droite ; téléphone : liste puis conversation).

## Intention et pourquoi

Rémi veut répondre à ses clients depuis le site, comme dans un chat, et garder chaque demande de devis rattachée à l'échange d'e-mails qu'elle déclenche. Ce module passe AVANT l'activation de l'envoi des e-mails du formulaire de contact (`ENVOI_PAR_SERVEUR` reste à `false` dans `public_html/assets/js/contact.js` jusqu'à sa mise en service).

Cycle voulu :
1. Un client envoie une demande (formulaire de `/contact.html`) : le site l'enregistre et Rémi reçoit une notification par e-mail dans sa boîte.
2. Sur le site, Rémi voit la demande complète dans la conversation du client.
3. Rémi répond depuis le site : un e-mail part vers le client. Une pièce jointe (par exemple un devis PDF) est FACULTATIVE, seulement si Rémi la joint.
4. Quand le client répond, la réponse arrive dans `contact@studionovae.org`. Les pages d'administration relèvent la boîte à l'ouverture puis toutes les 15 secondes tant qu'elles restent ouvertes, et ajoutent le message à la conversation (décision de Rémi du 2026-11-05 : relève à la demande, sans tâche planifiée).

## Objectifs

- Une conversation par adresse e-mail client, avec ses demandes de devis et tous ses e-mails, classés par date d'envoi (en-tête `Date` du message, pas l'heure de relève).
- Un e-mail reçu d'une adresse sans demande de devis suit le même traitement : il ouvre une conversation (étiquette « sans demande »).
- Plusieurs demandes d'un même client s'empilent dans sa conversation, chacune en carte de demande (suggestion validée par Rémi).
- Marqueur « non lu » dans la liste, avec compteur (suggestion validée).
- Pièces jointes reçues affichées en téléchargement (suggestion validée).
- Table `utilisateur` et table `coordonnee` créées maintenant (servent aussi pour la suite).
- Page d'administration à onglets : « Conversations » est le premier onglet ; d'autres outils viendront (« Utilisateurs », autres) sous forme d'onglets.
- Aucune notification supplémentaire envoyée par le site : Rémi reçoit déjà celle de sa boîte.

## Hors périmètre

- Comptes clients, connexion client et accès client au fil de discussion : plus tard. Le modèle reste ouvert pour cela (statut `utilisateur`, lien `utilisateur_id` sur les conversations), sans rien construire.
- Les autres outils d'administration (onglets futurs) : seuls l'ossature d'onglets et l'onglet Conversations sont construits.
- Activation de l'envoi du formulaire par le serveur (point 4 de `studio-novae-demain-2026-11-05`) : suit ce module.

## Contre-objectifs (échec même si « ça marche »)

- Un mot de passe stocké en clair.
- Un client dont l'e-mail est lu comme une prise de contrôle de compte : personne ne peut s'approprier un compte d'une adresse sans en prouver la possession.
- Une valeur de coordonnée non contrôlée (`javascript:` dans une URL de site, par exemple), ou affichée sans échappement.
- Une conversation mélangée entre deux clients, ou des messages dans le désordre.
- Des e-mails relevés deux fois (doublons) ou perdus.

## Données

### Table `utilisateur`
- `id` ; `email` (unique, clé de recherche) ; `mdp` (vide pour un client enregistré sans inscription) ; `statut` : `utilisateur`, `partenaire` ou `admin`.
- Choix de l'auteur du document (à confirmer par Rémi, sans objection exprimée) : le `mdp` est haché avec scrypt (module `crypto` de Node), jamais en clair.
- Un client qui écrit ou envoie une demande est enregistré comme `utilisateur` sans mot de passe (décision de Rémi : « sans avoir à faire une inscription complète »). S'il crée un compte plus tard, il utilise la même adresse et définit son mot de passe via un lien envoyé à cette adresse (décision de Rémi : « naturellement, oui »).

### Table `coordonnee` (liaison)
- `id` ; `utilisateur_id` ; `type` ; `valeur`. Sur le modèle de producteurslocaux.org : on ajoute des types sans modifier la base.
- Décision de Rémi : `valeur` dépend de `type`, avec une vérification (et sécurité d'entrée) propre à chaque type.
- Proposition (non décidée par Rémi) : liste des types dans le code, chacun avec sa règle de contrôle ; types de départ : `telephone` (numéro normalisé), `url_site` (http(s) uniquement), `adresse` (texte borné), `instagram`, `facebook`, `linkedin` ; un type inconnu est refusé ; la valeur est échappée à l'affichage ; plusieurs coordonnées d'un même type autorisées.

### Conversations et messages
- Une conversation par utilisateur (donc par adresse e-mail). Les messages (reçus, envoyés, demandes de devis) y sont rattachés avec : sens (entrant/sortant), date du message, objet, corps, identifiant du message e-mail (pour éviter les doublons), état lu/non lu, pièces jointes.
- Les demandes de devis existantes sont dans la table `demandes` (`src/base.js`) : elles doivent apparaître dans la conversation du client correspondant (par e-mail `mail`). Le schéma exact est laissé au constructeur.

## Relève de la boîte

- La boîte `contact@studionovae.org` est relevée par lecture IMAP à la demande : la page d'administration appelle `POST /admin/api/actualiser` à l'ouverture puis toutes les 15 s tant qu'elle est visible ; une pause de 10 s côté serveur évite les relèves en double (plusieurs onglets). Aucune tâche planifiée ni minuteur serveur (décision de Rémi, remplace « toutes les minutes »).
- Rattachement par adresse de l'expéditeur ; message classé par sa date d'envoi.
- Réserve non mesurée : les limites de connexions IMAP de Hostinger sur le compte mutualisé (`u109490155`, partagé avec d'autres sites). À tester avec la vraie boîte avant de conclure que toutes les minutes passent.

## Écran d'administration

- Page réservée au statut `admin` pour l'instant (décision de Rémi), connexion par e-mail et mot de passe.
- En-tête de page : étiquette « Page d'administration », titre « Administration », onglets (« Conversations » actif ; « Utilisateurs » et « Autres outils » en exemples « bientôt », à remplacer par les vrais outils de Rémi).
- Ordinateur : colonne de liste (filtres Toutes / Non lues / Devis, avatar à initiales, aperçu du dernier message, heure, compteur) et colonne de conversation (carte de demande, messages en ordre chronologique, zone de réponse avec « Joindre un fichier » et « Envoyer »).
- Téléphone : la liste, puis la conversation avec retour.
- Style : celui du site (bleu nuit `#0a1230`, brume `#eef1f9`, cartes blanches, Space Grotesk et Manrope, bouton d'action vert vif `#a8dc5a`) ; marges fines sur téléphone (8-12 px).

## Contraintes du projet

- Node 20+, pages générées par Node (`src/`, `server.js`), une seule dépendance aujourd'hui (`mysql2`), base MySQL Hostinger `u109490155_studionovae`, envoi SMTP déjà prêt (`src/courriel.js`), `.env` pour les secrets (`DB_PASS`, `SMTP_PASS` renseignés).
- Textes du site écrits en positif (règle `feedback-ecriture-positive-sans-negation`).
- Branche de travail `apercu` ; pas de commit ni de push sans demande de Rémi.

## Hébergement (réponse déjà connue)

- Production : `main`, application Node persistante chez Hostinger (compte mutualisé `u109490155`), avec base MySQL et boîte `contact@studionovae.org` au même endroit. La relève et les sessions tournent donc dans ce processus Node ou par cron Hostinger.
- Aperçu : `apercu`, suivie par Render (disque éphémère). La base MySQL Hostinger n'y est pas joignable (`DB_HOST=localhost`) : l'administration n'est prévue qu'en production ; en aperçu, la base reste désactivée comme aujourd'hui.

## Choix du rédacteur (appels faits sans Rémi, à relire)

- Session admin : cookie `HttpOnly`, `Secure`, `SameSite=Strict`, durée 8 h ; jeton anti-CSRF sur les envois ; limitation des tentatives de connexion (5 échecs, pause de 15 min par adresse et par IP).
- Pièces jointes : 10 Mo maximum par message, téléchargement forcé (`Content-Disposition: attachment`), jamais affichées en ligne ; stockage sur disque du serveur Hostinger, hors du dossier servi.
- Corps reçus : texte brut affiché ; le HTML est converti en texte ; les citations de messages précédents restent visibles mais repliées.
- Rattachement des e-mails reçus : par l'adresse `From` ; `Reply-To` ignoré. Tout e-mail ouvre une conversation (décision de Rémi) ; une action « Archiver » retire un expéditeur indésirable de la liste (spams, rebonds) sans supprimer ses messages.
- Usurpation : si `Authentication-Results` indique un échec SPF/DKIM, le message s'affiche avec un avertissement et reste classé.
- E-mails sortants : expéditeur `contact@studionovae.org`, objet `Re:` conservé, en-têtes `In-Reply-To` et `References` posés ; copie dans « Envoyés » ; un échec d'envoi s'affiche sur le message avec un bouton « Renvoyer ».
- Demandes existantes : rattachées rétroactivement à la conversation de leur adresse, datées du jour d'enregistrement. Lors de la première relève, les e-mails déjà dans la boîte sont importés et marqués lus.
- Premier compte `admin` : créé par une commande en ligne de commande (`node scripts/creer-admin.js`) qui demande le mot de passe ; mot de passe oublié de l'admin : même commande, pas d'écran dédié pour l'instant.
- Filtres de la liste : « Toutes », « Non lues », « Devis » (conversations contenant une demande) ; un seul admin supposé pour l'état lu/non lu.

## Laissé au constructeur

- Schéma exact des tables de conversations et de messages ; stockage des pièces jointes (disque ou base).
- Bibliothèques IMAP et d'analyse des e-mails (ajouter une dépendance est un choix à signaler à Rémi) ; façon de lancer la tâche planifiée (cron Hostinger ou minuteur dans le serveur).
- Gestion de session de l'administrateur ; création du premier compte `admin`.
- Tests : dans la lignée des scripts `scripts/test-*.js` existants.
