# Conversations par e-mail et administration — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page d'administration (statut `admin`) où Rémi lit les demandes de devis et les e-mails de ses clients en conversations, répond par e-mail avec pièce jointe facultative, et où la boîte `contact@studionovae.org` est relevée automatiquement.

**Architecture:** Couche de données MySQL (cinq tables déjà créées en production) appelée par une relève IMAP planifiée dans le processus Node, des routes `/admin/*` dans `server.js` (session par cookie signé) et une page d'administration générée côté serveur avec JS léger. Tous les accès SQL prennent un paramètre `db` (pool ou connexion) pour tester dans une transaction annulée.

**Tech Stack:** Node ≥ 20, `mysql2` (existant), `imapflow` et `mailparser` (NOUVELLES dépendances, à signaler à Rémi), `crypto` (scrypt, HMAC), scripts de test maison `scripts/test-*.js` (fonction `ok`).

**Spec:** `docs/superpowers/specs/2026-11-05-conversations-admin-design.md` (maquette : `.superpowers/brainstorm/600-1793869237/content/conversation-site-v3.html`).

## Global Constraints

- Pas de commit ni de push sans demande de Rémi ; travail sur la branche `apercu`.
- Textes visibles écrits en positif, sans négation (règle `feedback-ecriture-positive-sans-negation`).
- Marges fines sur téléphone (8-12 px) ; style du site : bleu nuit `#0a1230`, brume `#eef1f9`, vert vif `#a8dc5a`, Space Grotesk et Manrope.
- Mot de passe haché avec scrypt, jamais en clair ; `mdp` vide pour un client sans compte.
- Relève de `contact@studionovae.org` à la demande (page ouverte : à l'ouverture puis toutes les 15 s ; pause serveur de 10 s) ; messages classés par l'en-tête `Date`.
- Session admin 8 h, cookie `HttpOnly; Secure; SameSite=Strict`, jeton anti-CSRF, 5 échecs de connexion → pause de 15 min par adresse et par IP.
- Pièces jointes : 10 Mo maximum par message, téléchargement forcé, stockées hors du dossier servi.
- Les tests ne touchent jamais les données réelles : transaction annulée, ou faux pilotes. Les tables existent déjà ; `src/schema.js` les recrée à l'identique (`CREATE TABLE IF NOT EXISTS`).
- Aucune notification supplémentaire n'est envoyée par le site à Rémi.
- `ENVOI_PAR_SERVEUR` dans `public_html/assets/js/contact.js` reste `false` (hors périmètre).

## Review Focus

- Corps d'e-mail contenant du HTML ou `<script>` : affiché en texte échappé, jamais interprété.
- Adresse `From` en `"Claire Martin" <Claire@Boulangerie.FR>` : même conversation que `claire@boulangerie.fr`.
- Deux relèves simultanées (minuteur + script manuel) ou un e-mail relevé deux fois : aucun doublon.
- Nom de pièce jointe `../../x.exe` ou très long : assaini, jamais écrit hors du dossier de stockage.
- Boîte IMAP injoignable ou mot de passe refusé : le serveur continue de servir, aucune relève ne chevauche la précédente, nouvel essai à la minute suivante.

## File Structure

- `src/schema.js` — SQL des cinq tables ; `preparerSchema(db)`.
- `src/utilisateurs.js` — mots de passe et utilisateurs.
- `src/coordonnees.js` — types de coordonnées et leurs contrôles.
- `src/conversations.js` — conversations, messages, pièces jointes (données).
- `src/courriel.js` (modifié) — envoi avec destinataire libre, en-têtes de réponse, pièces jointes.
- `src/boite.js` — lecture IMAP et conversion en messages ; `src/releve.js` — orchestration et minuteur.
- `src/session.js` — sessions, CSRF, limitation de connexion.
- `src/admin.js` — routes `/admin/*` ; `src/pages/admin.js` — HTML de la page.
- `public_html/assets/css/admin.css`, `public_html/assets/js/admin.js` — interface.
- `scripts/creer-admin.js`, `scripts/releve-boite.js`, `scripts/test-*.js`.

---

### Task 1: Schéma et pilote partagé

**Files:** Create `src/schema.js`, `scripts/test-conversations.js`; Modify `src/base.js` (exposer `pool`), `package.json` (script `test:conversations`).

**Interfaces:**
- Produces: `SCHEMA: string[]` (les 5 `CREATE TABLE IF NOT EXISTS`, ordre : utilisateur, coordonnee, conversation, message, piece_jointe) ; `preparerSchema(db): Promise<void>` ; `base.pool(): Pool` ; `avecTransactionAnnulee(fn: (db) => Promise<void>): Promise<void>` (dans `scripts/test-conversations.js`, ouvre une connexion, `beginTransaction`, exécute, `rollback`).

- [ ] **Step 1:** Test `schema : les 5 tables existent après preparerSchema` (`SHOW TABLES` contient les 5 noms) et `schema : preparerSchema deux fois sans erreur`. Le test saute avec le message « base non configurée » si `base.estConfiguree()` est faux.
- [ ] **Step 2:** `npm run test:conversations` doit échouer (module absent).
- [ ] **Step 3:** Implémenter `src/schema.js` avec les définitions exactes des tables créées le 2026-11-05 (voir note mémoire `studio-novae-tables-conversations-creees-2026-11-05`) ; exporter `pool` depuis `src/base.js`.
- [ ] **Step 4:** Le test passe.

### Task 2: Utilisateurs et mots de passe

**Files:** Create `src/utilisateurs.js`, `scripts/creer-admin.js`; Test: `scripts/test-conversations.js`.

**Interfaces:**
- Produces: `hacherMotDePasse(mdp: string): string` (format `scrypt$sel$hash` en base64) ; `verifierMotDePasse(mdp: string, enregistre: string|null): boolean` (faux si `null`) ; `normaliserEmail(adresse: string): string` (extrait l'adresse de `"Nom" <a@b>`, minuscules, retire les espaces ; `''` si invalide) ; `trouverOuCreer(db, email: string): Promise<{id: number, email: string, statut: string}>` ; `creerAdmin(db, email, mdp): Promise<number>` ; `trouverParEmail(db, email): Promise<{id, email, mdp, statut}|null>`.

- [ ] **Step 1:** Tests : `hash : verifierMotDePasse accepte le bon et refuse le mauvais` ; `hash : deux hachages du même mot de passe diffèrent` ; `hash : mdp vide en base refuse tout` ; `email : "Claire Martin" <Claire@Boulangerie.FR> → claire@boulangerie.fr` ; `email : texte sans @ → ''` ; `trouverOuCreer : deux appels (casse différente) donnent le même id et statut utilisateur, mdp null` (dans `avecTransactionAnnulee`).
- [ ] **Step 2:** Échec attendu (module absent).
- [ ] **Step 3:** Implémenter ; `trouverOuCreer` utilise `INSERT ... ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)` pour rester sûr en concurrence. `scripts/creer-admin.js` lit l'e-mail en argument et le mot de passe sur l'entrée standard (saisie masquée), refuse moins de 12 caractères, met le statut `admin` (crée ou promeut).
- [ ] **Step 4:** Les tests passent.

### Task 3: Coordonnées contrôlées par type

**Files:** Create `src/coordonnees.js`; Test: `scripts/test-conversations.js`.

**Interfaces:**
- Produces: `TYPES: Record<string, (valeur: string) => string|null>` (renvoie la valeur normalisée, ou `null` si refusée) avec les clés `telephone`, `url_site`, `adresse`, `instagram`, `facebook`, `linkedin` ; `ajouterCoordonnee(db, utilisateurId, type, valeur): Promise<number>` (lève `Error('Type de coordonnée inconnu')` ou `Error('Valeur refusée pour ' + type)`) ; `lireCoordonnees(db, utilisateurId): Promise<{id, type, valeur}[]>`.

- [ ] **Step 1:** Tests : `url_site refuse javascript:alert(1)` ; `url_site accepte https://exemple.fr/a?b=1` ; `url_site refuse http://` seul ; `telephone : "06 12 34 56 78" → "+33612345678"`, `"abc"` refusé ; `adresse : 300 caractères refusée (limite 200)` ; `type inconnu refusé` ; `deux téléphones pour un même utilisateur acceptés` (transaction annulée).
- [ ] **Step 2-4:** Échec, implémentation (une fonction de contrôle par type), succès.

### Task 4: Données des conversations

**Files:** Create `src/conversations.js`; Test: `scripts/test-conversations.js`.

**Interfaces:**
- Consumes: `trouverOuCreer`, `normaliserEmail` (Task 2).
- Produces :
  - `ouvrirConversation(db, email: string): Promise<{conversationId: number, utilisateurId: number}>` (crée utilisateur et conversation si absents).
  - `ajouterMessage(db, conversationId, m: {sens: 'entrant'|'sortant', nature: 'email'|'demande', demandeId?: string, messageIdEmail?: string, objet?: string, corps: string, envoyeLe: Date, lu?: boolean, statutEnvoi?: 'envoye'|'en_attente'|'echec', authEchec?: boolean}): Promise<{id: number, nouveau: boolean}>` (`nouveau = false` si `messageIdEmail` existe déjà ; met à jour `dernier_message_le` au plus récent des deux dates).
  - `ajouterPieceJointe(db, messageId, p: {nom: string, typeMime?: string, taille: number, chemin: string}): Promise<number>`.
  - `listerConversations(db, filtre: 'toutes'|'non_lues'|'devis', inclureArchivees = false): Promise<{id, email, nom: string|null, apercu: string, dernierLe: Date, nonLus: number, sansDemande: boolean, nbDemandes: number}[]>` (tri par `dernier_message_le` décroissant).
  - `lireConversation(db, id): Promise<{conversation, utilisateur, coordonnees, messages: {…, piecesJointes: {id, nom, taille}[]}[]} | null>` (messages triés par `envoye_le` puis `id`).
  - `marquerLu(db, conversationId): Promise<void>` ; `archiver(db, conversationId, valeur: boolean): Promise<void>` ; `rattacherDemande(db, d: ligne de la table demandes): Promise<void>` (message `nature = 'demande'`, daté de `recue_le`, corps = résumé texte des champs) ; `rattacherDemandesExistantes(db): Promise<number>` (rattrapage de la table `demandes` si elle existe, idempotent via `demande_id`).

- [ ] **Step 1:** Tests (transaction annulée) : `deux messages dans le désordre sont lus dans l'ordre de leur date` ; `même messageIdEmail deux fois → nouveau=false, un seul message` ; `ouvrirConversation avec casse différente → même conversation` ; `non lues : le compteur ne compte que les entrants non lus` ; `filtre devis ne renvoie que les conversations avec une demande` ; `sansDemande vrai pour une conversation d'e-mails seuls` ; `archiver retire la conversation de la liste par défaut, ses messages restent` ; `rattacherDemande deux fois → un seul message de nature demande` ; `corps avec <script> relu à l'identique (aucune transformation en base)`.
- [ ] **Step 2-4:** Échec, implémentation, succès.
- [ ] **Step 5:** Brancher `src/api-contact.js` : après `base.inserer(ligne)` réussi, appeler `conversations.rattacherDemande(base.pool(), ligne)` ; son échec est consigné sans bloquer la réponse. Test dans `scripts/test-contact.js` : la demande enregistrée appelle le rattachement (faux pilote), un échec du rattachement laisse la réponse `ok: true`.

### Task 5: Envoi de courriel sortant

**Files:** Modify `src/courriel.js`; Test: `scripts/test-contact.js` (section courriel existante).

**Interfaces:**
- Produces: `construireMessage({de, a, repondreA, sujet, texte, domaine, enReponseA?: string, references?: string[], pieces?: {nom: string, typeMime: string, contenu: Buffer}[], messageId?: string}): string` (multipart/mixed si `pieces` non vide) ; `envoyer({sujet, texte, repondreA, a?, enReponseA?, references?, pieces?}, cfg): Promise<{messageId: string, brut: string}>` — `a` remplace `cfg.destinataire` quand il est donné (la page Contact garde son comportement).

- [ ] **Step 1:** Tests : `en-têtes In-Reply-To et References posés` ; `nom de pièce jointe avec retour à la ligne ou guillemets assaini` ; `sans pièce jointe : message identique à l'existant (Content-Type text/plain)` ; `avec pièce jointe : multipart/mixed, boundary unique, contenu en base64` ; `destinataire avec \r\n dans a est refusé (Error)` ; `envoyer renvoie le messageId posé dans l'en-tête`.
- [ ] **Step 2-4:** Échec, implémentation (sans dépendance, comme le fichier actuel), succès. Les tests existants de la page Contact passent inchangés.

### Task 6: Relève de la boîte IMAP

**Files:** Create `src/boite.js`, `src/releve.js`, `scripts/releve-boite.js`; Modify `package.json` (dépendances `imapflow`, `mailparser`), `server.js` (démarrage du minuteur), `.env.example` (variables `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASS`, `RELEVE_MINUTES`, `PIECES_DIR`) ; Test: `scripts/test-releve.js` (script `test:releve`).

**Interfaces:**
- Consumes: `ouvrirConversation`, `ajouterMessage`, `ajouterPieceJointe` (Task 4).
- Produces :
  - `boite.lireNouveaux(cfg, depuisUid: number): Promise<{uid: number, brut: Buffer}[]>` et `boite.copierEnvoyes(cfg, brut: string): Promise<void>` (IMAP `APPEND` dans « Sent »).
  - `releve.convertir(brut: Buffer): Promise<{de: string, messageId: string, objet: string, corps: string, date: Date, authEchec: boolean, pieces: {nom, typeMime, contenu: Buffer}[]}>` (texte brut ; HTML converti en texte ; `Date` absente ou postérieure à maintenant + 1 h → date de réception ; `messageId` absent → empreinte SHA-256 du brut ; `authEchec` vrai si `Authentication-Results` contient `spf=fail`, `dkim=fail` ou `dmarc=fail`).
  - `releve.passer(deps: {db, lireNouveaux, dossierPieces: string, maintenant: () => Date}): Promise<{ajoutes: number}>` : verrou en mémoire (un seul passage à la fois, un second appel renvoie `{ajoutes: 0}` immédiatement) ; à la toute première relève, les messages existants sont importés avec `lu = true` ; les suivants avec `lu = false` ; mémorise le dernier UID relevé dans un fichier d'état `releve-etat.json` du dossier `DATA_DIR`.
  - (Remplacé le 2026-11-05 : plus de minuteur ; `POST /admin/api/actualiser` lance `passer` à la demande, voir `src/admin.js`.)

- [ ] **Step 1:** Tests avec faux `lireNouveaux` et transaction annulée : `convertir : From "Claire" <Claire@Boulangerie.FR> → de normalisé` ; `convertir : HTML seul → texte sans balises, <script> retiré` ; `convertir : sans Message-ID → empreinte stable (deux appels, même valeur)` ; `convertir : Date future → date de réception` ; `convertir : spf=fail → authEchec` ; `passer : le même e-mail relevé deux fois → un seul message` ; `passer : deux appels simultanés → un seul traitement (le second renvoie ajoutes=0)` ; `passer : nom de pièce jointe ../../x.exe → fichier écrit sous dossierPieces avec un nom assaini` ; `passer : pièce jointe de plus de 10 Mo non stockée, message conservé avec mention dans le corps` ; `passer : premier passage → messages lus ; passage suivant → non lus` ; `passer : lireNouveaux qui échoue → l'erreur remonte, aucun message partiel` ; `minuteur : une erreur ne l'arrête pas (faux minuteur)`.
- [ ] **Step 2-4:** Échec, implémentation, succès. Ajouter les deux dépendances (`npm install imapflow mailparser`) puis le démarrage conditionnel dans `server.js` après `listen`.
- [ ] **Step 5:** `scripts/releve-boite.js` lance un passage unique et affiche le nombre de messages ajoutés ; vérifier à la main avec la vraie boîte de Rémi (limite de connexions IMAP de Hostinger non mesurée : relever aussi le temps de connexion et noter le résultat dans la mémoire `memoire`).

### Task 7: Sessions et connexion

**Files:** Create `src/session.js`; Test: `scripts/test-admin.js` (script `test:admin`).

**Interfaces:**
- Consumes: `trouverParEmail`, `verifierMotDePasse` (Task 2).
- Produces: `creerSession(utilisateurId: number, secret: string, maintenant = Date.now()): {cookie: string, csrf: string}` ; `lireSession(cookieHeader: string|undefined, secret: string, maintenant = Date.now()): {utilisateurId: number, csrf: string}|null` (HMAC SHA-256, expiration 8 h, comparaison à temps constant) ; `limiteur: {echec(cle: string, maintenant?): void, bloque(cle: string, maintenant?): boolean, reussite(cle: string): void}` (5 échecs → blocage 15 min, clés `mail:` et `ip:`) ; `connecter(db, email, mdp, ip, secret): Promise<{cookie, csrf}|{erreur: string}>` (statut `admin` exigé ; message d'erreur identique pour mail inconnu et mauvais mot de passe).
- Variable : `SESSION_SECRET` (obligatoire pour activer `/admin`, au moins 32 caractères).

- [ ] **Step 1:** Tests : `cookie falsifié refusé` ; `session expirée après 8 h` ; `6e tentative bloquée même avec le bon mot de passe` ; `blocage levé après 15 min` ; `statut utilisateur (non admin) refusé avec le même message` ; `cookie de l'admin A rejoué avec un autre secret refusé`.
- [ ] **Step 2-4:** Échec, implémentation, succès.

### Task 8: Routes d'administration

**Files:** Create `src/admin.js`; Modify `server.js` (délègue `/admin` et `/admin/*` à `admin.traiter(req, res)` avant les pages générées) ; Test: `scripts/test-admin.js`.

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 6, 7.
- Produces: `traiter(req, res, deps?): void` (deps injectables : `db`, `secret`, `envoyerCourriel`, `copierEnvoyes`, `dossierPieces`) avec ces routes (réponses JSON sauf la page et les téléchargements) :
  - `GET /admin/` page (voir Task 9) ; sans session → formulaire de connexion.
  - `POST /admin/connexion` {email, mdp} → pose le cookie ; `POST /admin/deconnexion`.
  - `GET /admin/api/conversations?filtre=` → liste ; `GET /admin/api/conversations/:id` → détail et marque lu.
  - `POST /admin/api/conversations/:id/reponse` {texte, pieces?: [{nom, typeMime, base64}]} + en-tête `X-CSRF` → envoie, enregistre le message sortant (`en_attente` puis `envoye` ou `echec` avec `erreur`) ; `POST .../renvoyer/:messageId` ; `POST .../archiver` {valeur}.
  - `GET /admin/pieces/:id` → fichier en `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`.
  - Toutes les réponses `/admin` : `Cache-Control: no-store`, `X-Robots-Tag: noindex`. Sans `SESSION_SECRET` ou sans base : 404 sur toute la zone.

- [ ] **Step 1:** Tests (faux `db`/courriel, requêtes HTTP réelles sur un serveur local éphémère) : `sans cookie : /admin/api/conversations → 401` ; `POST sans X-CSRF → 403` ; `réponse : le message sortant est enregistré avec Message-ID et In-Reply-To du dernier message entrant` ; `réponse avec échec SMTP : statut echec, erreur consignée, renvoyer le passe à envoye` ; `réponse avec pièce jointe de plus de 10 Mo → 413` ; `adresse du destinataire = e-mail de la conversation, jamais fournie par le client HTTP` ; `GET /admin/pieces/:id d'une pièce hors du dossier de stockage → 404` ; `SESSION_SECRET absent → 404 partout` ; `corps contenant <script> renvoyé tel quel en JSON (l'échappement se fait à l'affichage)`.
- [ ] **Step 2-4:** Échec, implémentation, succès ; appeler `copierEnvoyes` après un envoi réussi (son échec est consigné sans annuler l'envoi).

### Task 9: Page d'administration

**Files:** Create `src/pages/admin.js`, `public_html/assets/css/admin.css`, `public_html/assets/js/admin.js`; Modify `src/admin.js` (sert la page), `scripts/controle-site.js` (aucune page `/admin` dans le plan du site) ; Test: `scripts/test-admin.js`.

**Interfaces:**
- Consumes: routes de Task 8.
- Produces: `pageAdmin({connecte: boolean, csrf?: string, email?: string}): string` (HTML complet avec le gabarit `src/layout.js` du site, `noindex`, CSS `admin.css`, JS `admin.js`).

- [ ] **Step 1:** Tests : `page connectée : bandeau « Page d'administration », titre « Administration », onglet « Conversations » actif` ; `page non connectée : formulaire de connexion seul, aucune donnée` ; `la page contient <meta name="robots" content="noindex">` ; `admin.js affiche le corps d'un message via textContent (aucun innerHTML sur du contenu reçu)` — vérifié par une analyse du fichier ; `/admin absent de /sitemap.xml et robots.txt contient Disallow: /admin/`.
- [ ] **Step 2-4:** Implémenter la page d'après la maquette : ordinateur en deux colonnes (liste à gauche, fil à droite, filtres Toutes / Non lues / Devis, avatar à initiales, badge de non lus, étiquette « sans demande », carte de demande, messages en bulles, zone de réponse avec « Joindre un fichier » et « Envoyer », bouton « Archiver ») ; téléphone (≤ 800 px) : liste puis conversation avec retour, marges 8-12 px ; onglets du bandeau : « Conversations » actif, les autres en « bientôt ». Mise à jour de la liste par interrogation toutes les 30 s tant que la page est visible.
- [ ] **Step 5:** Vérification visuelle en largeur ordinateur et 390 px (captures dans `screenshot/`), puis montrer à Rémi.

### Task 10: Mise en service

**Files:** Modify `package.json` (scripts `test:*` regroupés dans `npm test`), `.env.example`; aucune autre.

- [ ] **Step 1:** `npm test`, `npm run test:demarrage`, `npm run test:contact`, `npm run test:base`, `npm run test:conversations`, `npm run test:releve`, `npm run test:admin` et `npm run controle` passent.
- [ ] **Step 2:** Documenter dans `.env.example` : `SESSION_SECRET`, `IMAP_*`, `RELEVE_MINUTES`, `PIECES_DIR`. Rappeler à Rémi ce qu'il doit faire chez Hostinger : mêmes variables dans le `.env` du serveur, `npm install` (nouvelles dépendances `imapflow` et `mailparser`), dossier de pièces jointes hors de `public_html`, création du premier admin avec `node scripts/creer-admin.js <e-mail>`.
- [ ] **Step 3:** Écrire l'état dans la mémoire (`memory_add` du MCP `memoire` et `node memory-cli.js add`) : ce qui est fait, ce qui reste à déployer.
