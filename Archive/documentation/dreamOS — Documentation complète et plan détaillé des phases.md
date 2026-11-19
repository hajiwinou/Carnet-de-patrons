# dreamOS — Documentation complète et plan détaillé des phases

Nov 18, 2026 · @Hajar

## 1. Vision, contexte et principes

dreamOS transforme ton carnet de patrons de tricot (l'application « atelier-tricot ») en petit système d'exploitation personnel de style Windows 95/98, avec une touche Y2K et kawaii. Un premier mode « dreamOS (Windows rétro) » à six palettes existe déjà dans l'application actuelle : le chantier le transforme en vrai bureau à fenêtres. Le chantier est découpé en 8 jalons ; au 19 novembre 2026, le laboratoire a terminé le jalon 3 (modules métier) et livré les étapes 4.1 à 4.6a de la propriété des données ; le nouveau design change l'ordre des jalons suivants (voir la mise à jour au début de la section 6).

**Produit visé**

- Un bureau personnel avec raccourcis, plus un explorateur latéral qui pointent vers les mêmes destinations.
- Des applications intégrées : Home, Patterns, Projects, Library, PDF Reader, Downloads, Tools, Documentation, Settings.
- Un launcher compact (recherche, favoris, applications récentes), une barre système et une barre des tâches.
- Des onglets hybrides selon l'application, des outils secondaires flottants sur PC et en panneaux sur tablette et iPhone.
- Au démarrage : « Restore session » ou « Start fresh », sans jamais effacer les données.
- Le thème Bliss comme référence, dans un système de thèmes extensible. Aucun emoji comme icône d'interface.

**Principes directeurs**

- Préservation : aucune fonction supprimée sans inventaire ni validation.
- Migration progressive : l'application reste utilisable à chaque jalon, aucune réécriture totale.
- Une source de vérité par donnée ; identifiants stables ; anciennes sauvegardes toujours restaurables.
- Une seule architecture qui s'adapte au PC, à la tablette et à l'iPhone.
- Une seule autorité d'écriture par ressource pendant la transition (jamais de double écriture).

**Hors périmètre initial (différé)**

CSS final Bliss, palette définitive, icônes et illustrations définitives, animations, WIP Island, XP et récompenses, synchronisation cloud complète.

**Décisions techniques validées (spécification v1.0)**

| Décision | Choix |
| --- | --- |
| JavaScript | ES Modules natifs |
| Migration | Progressive, avec couche Legacy Adapter |
| Bundler | Aucun obligatoire |
| Hébergement | GitHub Pages / statique |
| Mode hors ligne | Prioritaire |
| Stockage historique | Conservé (localStorage + IndexedDB `carnet_patrons_db`, version 1, store `blobs`) |
| Fichiers originaux | Aucune modification pendant la préparation |

## 2. Architecture générale

dreamOS empile quatre couches (applications, moteur de bureau, services communs, stockage du navigateur) et l'ancien moteur `app.js` tourne à côté, relié aux nouveaux services par le seul Legacy Adapter.

&#91;embedded content: architecture cible · 4 couches et le pont Legacy Adapter\]

Lecture : les couches en pointillés (applications, moteur de bureau) restent à construire ; la couche colorée (services communs) est celle que la Phase 2 livre. Les services n'atteignent l'ancien moteur que par le Legacy Adapter, tandis que l'ancien moteur continue d'écrire directement dans le stockage.

**Les cinq zones de l'interface**

| Zone | Responsabilité |
| --- | --- |
| System bar | Launcher, recherche globale, actions rapides, notifications, horloge |
| Application tabs | Onglets contextuels des ressources ouvertes |
| Sidebar / Explorer | Navigation entre espaces et destinations |
| Workspace | Application active et contexte de travail |
| Taskbar | Applications ouvertes, application active, fenêtres réduites, zone système |

Ces zones sont logiques : leur disposition change selon l'écran (PC, tablette, iPhone), pas leurs responsabilités. C'est une seule architecture adaptative, pas trois applications.

**Règles de communication**

- Les applications appellent les services communs et ne modifient jamais les variables privées des autres applications.
- Pendant la transition, l'ancien moteur reste propriétaire des données métier ; Storage, Media, Backup et AI deviennent progressivement propriétaires de leurs opérations respectives.
- Une seule autorité d'écriture par ressource : jamais l'ancien moteur et un nouveau service qui écrivent la même donnée sans coordination.
- Métadonnées métier, session et ressources ne sont pas confondues ; les erreurs et les chargements sont rendus explicitement.
- Services prévus au-delà de la Phase 2 : Router, Window Manager, Tab Manager, Session Manager, File Manager, Theme Manager, Search Manager, compteur et chronomètre, Sync Manager (préparation seulement).

## 3. Spécification technique consolidée

La Phase 2 isole les mécanismes communs (stockage, médias, sauvegarde, IA, notifications, dialogues) dans des modules ES, sans toucher aux données ni à `app.js`. Chaque service est indépendant, initialisé une seule fois et déclaré dans le Service Registry.

| Service | Responsabilité et contraintes clés | Ordre indicatif |
| --- | --- | --- |
| Storage Manager | `get`, `set`, `remove`, `getBlob`, `saveBlob`, `deleteBlob`, `getAllBlobKeys`, `flush`, `getStatus`. Base `carnet_patrons_db` v1, store `blobs`, clés `carnet.*` : ni nom, ni version, ni schéma ne changent. `persist()`, `persistNow()` et `safetySnapshot()` restent distincts. | 1 |
| Media Manager | Blobs, cache mémoire, Object URLs (créées puis révoquées), chargement à la demande, médias manquants. Préfixes historiques : `pdf_`, `img_`, `th_`, `docm_`, `pjc_`, `pjp_`, `wall_`, `idea_`, `inspo_` (à confirmer sur tous les chemins de création et de suppression). | 2 |
| Backup Manager | Export, import et restauration du format historique v1 : `data.json`, dossier `blobs/`, `types.json`, parties de 200 Mo maximum. Une ancienne sauvegarde doit rester restaurable. | 3 |
| AI Manager | Catalogue de 5 fournisseurs (Gemini `gemini-2.5-flash`, Groq `llama-3.3-70b-versatile`, OpenRouter, OpenAI `gpt-4o-mini`, OmniRoute `auto`), contrat commun `generate` / `testConnection`, délais d'attente, erreurs normalisées. Les clés API ne sont jamais journalisées ni déplacées. | 4 |
| Notification Manager | `success`, `error`, `warning`, `info`, `show`, `dismiss` ; conserve l'élément `#toast`. | 5 |
| Dialog Manager | `confirm`, `alert`, `prompt`, `close` ; Escape, Entrée, piège de focus ; conserve `#dlg`. | 5 |
| Legacy Adapter | Pont contrôlé entre l'IIFE `app.js` et les modules ES : une seule autorité d'écriture par ressource, jamais l'état privé `S` exposé. | 6 |
| Event Bus et Service Registry | Communication sans dépendance circulaire (`storage:ready`, `media:saved`, `backup:completed`, `ai:request-started`, `session:restored`…) ; une instance unique par service. | Socle |

**Règles des modules ES**

1. Une responsabilité par module ; dépendances importées explicitement ; seule l'API publique est exportée.
2. Aucune dépendance implicite à une variable globale ; les applications ne touchent pas aux variables internes des autres.
3. Opérations asynchrones = Promises ; une erreur de sauvegarde ou d'écriture n'est jamais ignorée en silence.

**Contraintes d'hébergement (GitHub Pages)**

- Les modules ES exigent HTTP(S) : ne pas tester via `file://`.
- Chemins relatifs uniquement (pas de `/js/...`), un seul point d'entrée ES (`bootstrap.js`).
- PDF.js et JSZip gardent leur chargement différé.

**Démarrage sûr**

Les services ne démarrent pas avant que les anciennes données soient disponibles : HTML, moteur historique, IndexedDB, restauration des données, signal « Legacy Ready » (Promise `legacy.ready`), chargement puis vérification des services ES, application disponible.

**Mode hors ligne (exigence obligatoire)**

| Ressource | Stratégie du Service Worker |
| --- | --- |
| HTML principal | Network-first avec repli |
| Modules JS et CSS | Cache-first avec versionnement |
| Icônes et fonds d'écran | Cache-first |
| PDF.js et JSZip | Cache local avec repli |
| Données utilisateur et médias | IndexedDB |

Le précache doit couvrir tous les modules ES et leurs dépendances : un module manquant empêche le démarrage hors ligne même si `index.html` est là. Les services distants (IA, Instagram, Cobalt) ne fonctionnent pas sans réseau et affichent un message clair.

## 4. Audit de l'existant : constats et risques

L'application actuelle est un monolithe : `app.js` concentre état, logique métier, rendu, événements et persistance. Les constats ci-dessous viennent des notes d'audit des documents sources, pas d'un nouvel audit ; ceux marqués « à vérifier » doivent être revalidés sur la dernière version complète avant toute modification.

**Volumes rapportés**

| Élément | Volume |
| --- | --- |
| Archive | 78 entrées, 70 fichiers réels, environ 1,48 Mo décompressé |
| `app.js` | environ 6 644 lignes, 424 déclarations de fonctions (6 867 lignes dans le labo après l'ajout du pont Legacy Adapter) |
| `index.html` / `app-late.js` | 79 lignes / 21 lignes |
| `styles.css` / `styles-late.css` / `bliss.css` | 3 963 lignes / 1 661 lignes / environ 26 Ko |

**Fonctionnalités à préserver**

- Patrons : dossiers, sous-catégories, favoris, filtres, recherche, fiches, PDF, photos, miniatures, doublons, statuts.
- Projets : patrons liés, fils, aiguilles, couleurs, chronomètre, compteur de rangs, journal, photos, inspirations, statistiques, objectifs.
- PDF Reader : navigation, zoom, repères, surlignage, marqueurs, notes, position de lecture.
- Library et Documentation : idées, tableaux, collections, tags, articles, photos, vidéos.
- Tools : rangs raccourcis, échantillon, règle de trois, grilles de points, patron depuis photo, calculatrice, Instagram vers MP4, notes et journal.
- Système : thèmes, palettes, polices, fonds d'écran, verrouillage, multi-IA, sauvegarde et restauration.

**Risques et points d'attention**

| Sujet | Constat rapporté | Statut |
| --- | --- | --- |
| Concentration de logique | `app.js` mélange plusieurs responsabilités ; un changement peut avoir des effets de bord | Rapporté |
| Couches CSS | `styles.css` et `styles-late.css` se redéfinissent ; `.wrap` et `.tabbar` définis à plusieurs endroits ; Bliss utilise de nombreux `!important` | À vérifier |
| Stockage | localStorage (métadonnées, préférences) + IndexedDB (fichiers) + copies miroir + instantanés toutes les 5 minutes ; la duplication peut être un mécanisme de secours légitime | À vérifier |
| Suppression | `removePSoft()` (réversible) et `removeP()` (directe) ont des comportements différents | À vérifier |
| `saveFolders()` | Plusieurs chemins d'écriture possibles | À vérifier |
| Polices | 7 familles chargées, utilité à confirmer | À vérifier |
| Verrouillage | Hash PBKDF2/SHA-256 côté navigateur : il masque l'interface, ce n'est pas une authentification serveur ni une protection des fichiers | Rapporté |
| Clés API | Stockées dans le navigateur ; leur cycle de vie, leur affichage et leur exclusion des sauvegardes sont à documenter | Rapporté |
| Serveur Instagram | Serveur Python `0.0.0.0`, CORS ouvert à toutes les origines, clé API facultative, `yt-dlp` : authentification à rendre obligatoire en cas d'exposition réseau | Rapporté |
| Hors ligne | `themes/bliss.css`, son fond et ses icônes manquaient au précache | Corrigé en Phase 2.8 |
| Sauvegarde ZIP | Ne contient pas thème, favoris d'auteurs, clés IA, mot de passe, positions PDF… : à reconfigurer sur un autre appareil | Confirmé en Phase 2.8, à arbitrer en Phase 3 |
| Interactions réelles PC / iPhone | Pas encore testées | À tester |

**Recommandation de l'audit** : ne pas repartir de zéro. Inventorier fonctions et formats de données, puis séparer progressivement les responsabilités ; ne supprimer ni fusionner une fonction avant d'avoir vérifié ses usages et ses effets sur les données.

## 5. État du laboratoire

### Mise à jour du 19 novembre 2026 (version 4.6.0)

Ton laboratoire est nettement plus avancé que ce que décrivait la première version de cette documentation. J'ai ouvert le zip de la version 4.6a et relancé ses tests.

- **Jalon 3 terminé** : les 8 modules métier existent (Settings, Tools, Library, Downloads, Patterns, Projects, PDF Reader, Documentation), chacun avec sa logique extraite et testée contre le code d'origine, et un retour arrière (`?module=legacy`).
- **Jalon 4 « Propriété des données » en cours** : 4.1 Documentation (articles), 4.2 Documentation (médias `docm_`), 4.3 Library (idées, tableaux, médias `ideam_`), 4.4 Tools (grilles, valeurs d'écran) avec le correctif de l'import de plusieurs photos, 4.5 Downloads (configuration Cobalt, clé jamais journalisée), 4.6a Projects (liste des projets). Restent 4.6b (médias `pjc_`, `pjp_`, `pji_`), 4.6c (champs d'un projet), puis Patterns.
- **Chiffres** : version 4.6.0, cache du service worker `atelier-tricot-v27`, `app.js` à 7 022 lignes (6 867 en phase 2.8).
- **Tests** : j'ai relancé tous les tests Node du zip et ils passent. Le test de format de sauvegarde (`phase2_8_backup_format`, jszip absent ici) et le test navigateur (`phase2_8_regression.browser`) restent à lancer chez toi à chaque livraison.
- **Toujours à faire** : le dossier `assets/` manque encore dans le zip (le test de précache signale `assets/island/tortue2.webp` absent), et tout le rendu HTML ainsi que les 179 actions `data-act` restent dans `app.js`.

### Rappel : état à la fin de la phase 2.8 (18 novembre)

Les sous-étapes 2.1 à 2.7 sont construites dans le laboratoire et la 2.8 est à moitié faite : les tests automatiques existent, la validation manuelle sur navigateur et iPhone reste à exécuter. Le moteur historique (`app.js`, `app-late.js`) n'est modifié que par un ajout : le pont Legacy Adapter. Aucun service n'est encore raccordé aux écritures métier historiques.

**Contenu de l'archive** (version runtime 2.7.0, cache Service Worker `atelier-tricot-v10`)

| Sous-étape | Livrable dans le labo | Tests automatisés |
| --- | --- | --- |
| 2.1 Infrastructure ES | `bootstrap.js`, `event-bus.js`, `service-registry.js` | `phase2_1.test.mjs` : réussi |
| 2.2 Storage | `storage-manager.js` | `phase2_2.test.mjs` : réussi |
| 2.3 Media | `media-manager.js` | `phase2_3.test.mjs` : réussi |
| 2.4 Backup | `backup-manager.js` | `phase2_4.test.mjs` : réussi |
| 2.5 AI | `ai/` (manager, providers, erreurs, adaptateurs `gemini` et `openai-compatible`) | `phase2_5.test.mjs` : réussi |
| 2.6 Notifications et Dialogs | `notification-manager.js`, `dialog-manager.js` | Aucun test automatique ; checklist manuelle |
| 2.7 Legacy Adapter | `legacy-adapter.js` + pont additif dans `app.js` | Aucun test automatique ; vérification en console |
| 2.8 Validation | Tests de précache, de format de sauvegarde, de non-régression navigateur, jeu de données fictif | Voir ci-dessous |

**Tests de la Phase 2.8**

- **Précache** : réussi pour le code (HTML, 14 modules ES, `@import` CSS). Il signale en avertissement que les fichiers `assets/` (par exemple `assets/island/*.webp`) sont listés mais absents du zip labo : ils sont donc non vérifiés.
- **Format de sauvegarde** : ignoré (SKIP) dans mon environnement faute de `jszip` ; à lancer après `npm i jszip`.
- **Non-régression navigateur** (`phase2_8_regression.browser.mjs`) : nécessite `playwright-core`, `jszip` et Chromium ; non lancé ici. Il importe une sauvegarde v1 100 % fictive (4 patrons, 2 dossiers, 3 projets, 11 fichiers) dans un profil vierge et contrôle les scénarios de non-régression avant et après rechargement.

**Reste à faire pour clôturer la Phase 2**

- [ ] Installation en ligne puis coupure réseau : l'application démarre avec thème et icônes.
- [ ] Mise à jour du Service Worker : l'ancien cache est supprimé.
- [ ] Sauvegarde ZIP complète d'avant la 2.7 restaurée dans un profil vierge (patrons, projets, PDF, repères).
- [ ] PDF : poser un repère et un compteur, fermer, rouvrir, tout est retrouvé.
- [ ] Console : `await dreamOS.legacy.ready` donne `ready`, et `getStateSnapshot()` ne contient ni clé API ni hash de verrouillage.
- [ ] iPhone (Safari, écran d'accueil) : tests hors ligne, restauration et PDF, sans recouvrement de la barre du bas.
- [ ] Quota presque plein : le message d'échec de sauvegarde s'affiche.
- [ ] Lancer les tests ignorés (format de sauvegarde, navigateur) et fournir les fichiers `assets/` manquants.
- [ ] Tests automatiques pour les Notifications, les Dialogs et le Legacy Adapter (aujourd'hui seulement manuels).

## 6. Plan détaillé des phases

### Mise à jour du plan (19 novembre 2026)

**Ce qui a changé.** Trois choses rendent l'ancien plan en partie caduc. Le laboratoire est plus avancé que prévu. Son jalon 4 s'appelle « Propriété des données », alors que la documentation d'origine réservait le jalon 4 à un « Desktop Engine ». Et tu as retravaillé le design : thème Bliss rose « XP mais mignon », 36 fiches d'écran, variables et composants prêts à l'emploi.

D'après les fichiers du thème (barre du haut, barre du bas à 5 entrées, fenêtres, volets inférieurs sur mobile), la navigation voulue ressemble à une application avec cadre de fenêtre, pas à un bureau avec lanceur, explorateur et barre des tâches. Je n'ai pas pu ouvrir les maquettes ni la spécification fonctionnelle (liens non partagés avec moi) : cette lecture reste à confirmer.

**Plan révisé proposé.**

1. Jalon 3, modules métier : terminé.
2. Jalon 4, propriété des données : 4.1 à 4.6a faits ; 4.6b (médias de projets) est déjà commencée et se termine avant l'habillage. 4.6c et Patterns sont mis en pause le temps de décider le modèle de données de la fiche WIP (section 11), puis repris.
3. Jalon 5, habillage Bliss rose écran par écran (remplace l'ancien jalon 8 et passe en premier) : 5.0 fondations (restaurer `assets/`, charger les variables et les composants, page de test des composants) ; 5.1 coquille de navigation ; 5.2 Bibliothèque ; 5.3 Projets et structure de la fiche WIP ; 5.4 Fiche patron ; 5.5 Lecteur PDF ; 5.6 Outils ; 5.7 Idées ; 5.8 Réglages ; 5.9 formulaires et états vides ; 5.10 retrait de l'ancien CSS.
4. Jalon 6, fonctions nouvelles une par une : carte Reprendre, file d'imports, note vocale, onglets Marqueurs et Matériel, compteurs multiples, éditeur de patron.
5. Jalon 7, autres thèmes (Doodle, Classique 95, Pixel RPG) uniquement par variables.
6. Jalon 8, fin de la propriété des données : 4.6b, 4.6c, Patterns, revendication des actions, retrait des replis historiques.
7. Jalon 9, validation fonctionnelle (l'ancien jalon 7) sur PC, tablette et téléphone.
8. Jalon 10, synchronisation (section 8), puis Mac et Android (section 12).

L'ancien Desktop Engine et l'ancien Bureau (fenêtres multiples, lanceur, explorateur, barre des tâches, gestionnaire d'onglets et de session) ne sont gardés que si la maquette les montre : c'est la première décision à prendre (section 13).

**Méthode recommandée pour l'habillage.**

- Habiller sans toucher au comportement, avec la discipline qui a bien marché pour les modules : une étape, une livraison zippée, un README, un retour arrière, des tests. Pour l'habillage, le retour arrière serait un interrupteur (par exemple `?skin=legacy`) qui garde l'ancien rendu intact jusqu'à la fin de l'étape 5.10.
- Charger `tokens.css` et `components.css` à côté de l'ancien CSS, et construire une page de test interne qui montre chaque composant dans chaque état avant de toucher le moindre écran.
- Remplacer le cadre actuel (la fenêtre unique `dream-window` et la barre à 6 onglets) par une petite coquille de navigation, sans moteur de fenêtres tant que la maquette n'en montre pas.
- Pour chaque écran : comparer à la maquette à 1280, 834, 390 et 360 px, vérifier l'absence de `!important` et de couleurs écrites en dur, lancer tous les tests Node, puis chez toi les deux tests qui manquent ici.
- Ajouter des captures d'écran automatiques par écran pour repérer les régressions visuelles.
- Les fonctions nouvelles viennent après l'habillage, avec des évolutions de données seulement additives (des champs en plus, jamais de renommage) pour que la sauvegarde v1 reste restaurable.

**Pourquoi c'est mieux que de construire d'abord le moteur de bureau.** Tu vois le résultat dès le premier écran, le risque reste limité au HTML et au CSS, et la navigation finale se décide à partir de ta maquette plutôt que de la documentation d'origine.

**Sources de vérité (d'après tes consignes de thème).** En cas de conflit : spécification fonctionnelle, puis maquette, puis ancien code. Si une règle manque, on demande, on ne devine pas.

**Règles de code non négociables.**

- Aucune couleur, ombre, rayon ou police en dur : tout passe par les variables de `tokens.css`. Aucun `!important`. Classes de composants préfixées `dos-`.
- Pas de style en ligne, sauf une valeur dynamique (largeur d'une jauge, position de la ligne de rang).
- Cibles tactiles d'au moins 44 px, contraste du texte d'au moins 4,5 contre 1, focus clavier visible, nom (`aria-label`) sur tout bouton qui n'a qu'une icône.
- Boutons de fenêtre (Réduire, Agrandir, Fermer) avec icône et nom ; aucun texte coupé (retour à la ligne ou ellipse avec titre complet accessible).
- Interface en français ; on ne renomme ni les clés de données ni les identifiants JavaScript ; on ne touche au HTML généré par `app.js` que pour la structure et les classes, jamais pour la logique.

**Vocabulaire à respecter dans l'interface.**

- Statuts uniquement sur les projets : En attente, WIP, Terminé. Les patrons n'ont pas de statut.
- Aucun pourcentage de progression : on affiche un compteur (« Corps · 42 / 120 »), le temps tricoté et les rangs comptés.
- Le journal est visible dans les trois pages de projet (En attente, WIP, Terminé) et s'écrit à un seul endroit. Le carnet souvenir est la page d'un projet Terminé, pas une entité séparée.
- Lecteur PDF : boutons Repère (punaise), Surligner (crayon), Marqueur (rond rouge) et Mes outils.
- Pastille d'état des données : tant que la synchronisation n'existe pas, ne pas écrire « Synchronisé » (texte à décider).
- Analyse IA en bêta ; les clés ne sont pas dans la sauvegarde ZIP.

**Ordre de travail écran par écran.** Barre du haut, Bibliothèque, Projets, Fiche patron, Lecteur PDF, Outils, Idées, Réglages, formulaires, états vides.

**Liste de contrôle pour chaque écran.**

- Rendu comparé à la maquette à 1280 (PC), 834 (tablette), 390 et 360 (téléphone).
- Aucun texte coupé ; navigation au clavier (Tab, Entrée, Échap) avec focus visible ; boutons d'au moins 44 px sur mobile et tablette.
- États couverts : normal, survol, focus, appuyé, désactivé, erreur, vide, chargement.
- Aucune couleur en dur ni `!important` hors `tokens.css` ; polices chargées avec un repli (Pixelify Sans, DM Sans, puis polices système).
- Une sauvegarde ZIP de test se restaure et les données s'affichent ; compteurs, chrono, journal, import et export se comportent comme avant.

**À ne pas faire.** Supprimer l'ancien CSS d'un écran avant la validation du nouveau ; ajouter une dépendance (framework CSS, bibliothèque d'icônes) sans demander ; modifier le format des données ou de la sauvegarde ZIP ; inventer une fonction absente de la spécification.

**Points tranchés ou précisés le 19 novembre.**

- **Ordre des travaux.** L'étape 4.6b (médias `pjc_`, `pjp_`, `pji_`) est déjà commencée : elle se termine avant l'habillage. L'étape 4.6c attend la décision sur les données de la fiche WIP.
- **Remplacement du CSS.** Tu comptes remplacer tout l'ancien CSS par le nouveau. Je recommande de le faire écran par écran (barre et cadre d'abord, puis chaque écran), en gardant l'ancien CSS d'un écran jusqu'à sa validation, pour pouvoir revenir en arrière si un écran casse. Cette recommandation n'est pas encore confirmée.
- **Les étapes 4.1 à 4.6a ne posent pas de problème** : elles suivent le principe d'une seule autorité d'écriture par ressource, ne changent ni les formats de données ni la sauvegarde, et la documentation d'origine était simplement en retard sur le laboratoire.
- **Dossier `assets/`.** Il est nécessaire, mais seulement pour une partie de l'appli : 32 icônes PNG (`assets/icons/` : catégories de patrons et icônes de l'ancien mode dreamOS) et 9 images de WIP Island (`assets/island/` : tortue, poulpe, narval, mouton, chat, chien, chenille, étoile), appelées par `app.js` et mises en cache par le service worker (41 fichiers). Sans lui, les icônes sont cassées et WIP Island perd ses animaux, mais aucune donnée n'est perdue. Les 60 icônes SVG du nouveau thème n'en dépendent pas. Il est absent des zips depuis la phase 2.8 et tes consignes de thème le disent à restaurer : on ne sait pas s'il a été laissé de côté volontairement. À faire : le retrouver dans le dépôt ou le site déployé et le remettre à côté d'`index.html` pour les tests. WIP Island devant rester telle quelle, `assets/island/` reste nécessaire ; le reste ne peut être retiré qu'une fois tous les écrans qui s'en servent remplacés.

Le projet suit 8 jalons dans un ordre qui protège les données d'abord, construit ensuite le système de bureau, et ne touche à l'apparence qu'à la fin ; aujourd'hui le jalon 2 est en cours de clôture (Phase 2.8). Les tests accompagnent chaque jalon et ne sont pas réservés à la fin. Les jalons 3 à 8 sont décrits à partir des documents fondateur et consolidé : leur découpage fin reste à affiner après la Phase 2.

&#91;embedded content: feuille de route · 8 jalons et leurs portes de validation\]

On ne passe au jalon suivant qu'après la porte de validation du précédent ; seul le jalon 2 est en cours.

| Jalon | Objectif | Phase du document fondateur | Statut |
| --- | --- | --- | --- |
| 1. Référence | Inventorier et figer l'existant | Phase 1 | Partiel : audit rapporté, pas encore d'audit traçable complet |
| 2. Fondations | Extraire les services communs (Phase 2, sous-étapes 2.0 à 2.8) | Phase 2 | En cours : 2.1 à 2.7 construites, 2.8 à moitié |
| 3. Modules métier | Séparer les applications | Phase 2 | À faire |
| 4. Desktop Engine | Shell, routeur, fenêtres, onglets, session | Phase 3 | À faire |
| 5. Bureau | Launcher, explorateur, raccourcis, barre des tâches | Phase 3 | À faire |
| 6. Intégration | Brancher les applications au nouveau bureau une par une | Phase 4 | À faire |
| 7. Validation | Tests PC, tablette, iPhone, données, hors ligne | Phase 5 | À faire |
| 8. Bliss | Thème final, icônes, détails visuels | Phase 6 | À faire |

### Jalon 1 — Référence (inventaire et plan de migration)

Objectif : remplacer les constats rapportés par un audit traçable sur la dernière archive réelle. Aucune modification de l'application avant la fin de cet inventaire.

- Travaux : inventorier fichiers, dépendances, fonctions (424 déclarations rapportées), interactions, données, stockages, sauvegardes, bugs et comportements responsive.
- Livrables : cartographie fonctionnelle (boutons, actions, écrans, données, dépendances) ; cartographie des données (objets, identifiants, relations, clés `carnet.*`, médias, couverture de sauvegarde) ; correspondance fonctions actuelles vers modules cibles, avec risques et tests ; liste des doublons, conflits, bugs et inconnues ; plan de migration priorisé.
- Sortie : une sauvegarde de référence et des scénarios de référence existent ; les points à vérifier de l'annexe du document fondateur (version exacte du dépôt, événements de `app.js` et `app-late.js`, règles CSS répétées, chemins d'écriture, formats d'export) sont tranchés.
- Dépendance : la dernière archive complète du projet (HTML, JS, CSS, thèmes, Service Worker, assets, serveur Python, lanceurs).

### Jalon 2 — Fondations : Phase 2, extraction des services communs

Objectif : isoler les mécanismes partagés sans migration destructive. Ordre réel imposé par les dépendances : infrastructure ES, Storage, Media (dépend de Storage), Backup (dépend des deux), AI, Notifications et Dialogs, Legacy Adapter. Un point de validation clot chaque sous-étape.

| Étape | Contenu | Condition de sortie | Statut |
| --- | --- | --- | --- |
| 2.0 Laboratoire | Copie de travail du ZIP, archive originale intacte, empreintes des fichiers, branche Git `feature/phase-2-services`, inventaire des clés localStorage et IndexedDB, jeu de données de test anonymisé, scénarios de non-régression | Version de référence créée ; fonctions `keep()`, `persist()`, `persistNow()`, `restoreAuxiliary()`, `restoreFromMirror()` examinées ensemble avant toute extraction du stockage | Préparé en labo (à confirmer) |
| 2.1 Infrastructure ES | `bootstrap.js`, `service-registry.js`, `event-bus.js`, conventions d'import | Chargement local OK, puis vérification sur GitHub Pages | Fait en labo ; GitHub Pages à vérifier |
| 2.2 Storage Manager | IndexedDB et localStorage, API commune, clés historiques et miroirs préservés | Toutes les anciennes données lisibles sans migration destructive | Fait en labo |
| 2.3 Media Manager | Blobs, Object URLs, caches, PDF et photos, suppressions | PDF et photos historiques accessibles ; URL révoquées | Fait en labo |
| 2.4 Backup Manager | Génération et restauration ZIP, format v1 conservé, archives multiparties | Une sauvegarde ancienne reste restaurable, test sur base isolée | Fait en labo |
| 2.5 AI Manager | Fournisseurs, requêtes uniformisées, configurations préservées, erreurs et délais | Les 5 fournisseurs testés (clés conservées) | Fait en labo ; 5 fournisseurs à tester |
| 2.6 Notifications et Dialogs | Confirmations, événements historiques, clavier et tactile | Notifications et dialogues fonctionnent, `#toast` et `#dlg` conservés | Fait en labo ; test manuel à faire |
| 2.7 Legacy Adapter | `window.DreamOSLegacy` (`ready`, `status`, `getStateSnapshot`, `refresh`, `notify`), pont additif dans `app.js` | Aucune double écriture ; snapshot sans clé API ni hash de verrouillage | Fait en labo ; test console à faire |
| 2.8 Validation finale | Non-régression, hors ligne, restauration, PC / tablette / iPhone, comparaison avec la version initiale | Les 13 critères de sortie ci-dessous | En cours |

**Critères de sortie de la Phase 2** (tous requis)

- [ ] Les modules ES se chargent sans erreur sur l'hébergement cible.
- [ ] Le Storage Manager lit et écrit les anciennes données.
- [ ] IndexedDB conserve son nom, sa version et son object store historique.
- [ ] Le Media Manager gère les Blob et les URL temporaires.
- [ ] Les PDF et photos historiques restent accessibles.
- [ ] Le Backup Manager exporte toujours un ZIP v1 compatible.
- [ ] Les anciennes sauvegardes sont restaurables.
- [ ] Les clés et configurations IA sont conservées.
- [ ] Les Notifications et Dialogs fonctionnent.
- [ ] Le Legacy Adapter évite les doubles écritures.
- [ ] Le Service Worker permet le démarrage hors ligne.
- [ ] Les tests de non-régression passent sur les fonctions existantes.
- [ ] Un retour arrière vers la version stable est documenté.

**Hors périmètre de la Phase 2** : refonte graphique Bliss, suppression de fonctionnalités, changement du modèle de données ou de la structure IndexedDB, remplacement de PDF.js, suppression du serveur Instagram, réécriture complète de `app.js`, Window Manager, synchronisation cloud.

**Validation et retour arrière** : trois environnements (Original = référence immuable, Migration = développement et tests, Preview = validation finale sur appareils) ; les tests de restauration se font sur un profil navigateur de test, jamais sur les vraies données. Chaque jalon produit une version identifiable (`v0-original`, `v1-esm-infrastructure`, `v2-storage`, `v3-media`, `v4-backup`, `v5-services`) et un retour arrière restaure code et Service Worker sans jamais effacer IndexedDB.

### Jalon 3 — Modules métier

**Mise à jour du 19 novembre : ce jalon est terminé** (étapes 3.0 à 3.11, version 3.11.0, cache `atelier-tricot-v21`). Chaque module a sa logique extraite et testée contre le code d'origine, et un retour arrière.

- Settings (apparence et fond d'écran, 3.3 et 3.4) : `?theme=legacy`.
- Tools (chronomètre et compteur de rangs, 3.5) : `?tools=legacy`.
- Library (filtre des épingles et recherche, 3.6) : `?library=legacy`.
- Downloads (client Cobalt, clé jamais stockée ni journalisée, 3.7) : `?downloads=legacy`.
- Patterns (moteur de fiche : texte, schéma, IA, grilles, 3.8) : `?patterns=legacy`.
- Projects (étape, fils et pelotes, plan de couleurs, notes, WIP Island, 3.9) : `?projects=legacy`.
- PDF Reader (page, durées, zoom, position, surcouches, 3.10) : `?pdfreader=legacy`.
- Documentation (brouillon, publication, médias, libellés, 3.11) : `?documentation=legacy`.

Chaque bascule peut aussi se relâcher à chaud avec `window.DreamOS<Module>Host.release()`. Le détail ci-dessous est l'ancien plan, conservé pour mémoire.

Objectif : séparer les huit applications en modules indépendants en conservant d'abord leurs interfaces et leurs comportements. La séparation physique des fichiers ne suffit pas : dépendances, effets de bord et contrats de données doivent être cartographiés avant chaque extraction, et le format d'API de chaque module reste à définir pendant l'audit détaillé du jalon 1.

| Module | Fonctions à préserver | Point d'attention |
| --- | --- | --- |
| Patterns | Dossiers et sous-dossiers, favoris, filtres, recherche, statuts, fiches, import, pièces jointes, doublons ; schéma (`garment`, `designer`, `difficulty`, `silhouette`, `gauge_sts`, `yarn_weight`, `stitches`, `r_rating`…) | `removePSoft()` et `removeP()` : analyser leurs usages avant toute fusion ; sollicite le service IA |
| Projects | Patrons liés, statuts, fils, aiguilles, couleurs, chronomètre, compteur, journal, photos, inspirations, statistiques, objectifs ; migrations historiques (`migratePjV32`, `migrateStages`) | Ne pas reconstruire un second système de projets sous un autre nom |
| PDF Reader | Onglets multi-PDF, zoom, repères et marque-pages, surlignage, marqueurs, notes, dernière page, miniatures | La chaîne PDF, patron, projet, page, compteur, notes, marqueurs est un invariant ; le moteur PDF ne devient pas propriétaire du compteur |
| Library | Tableaux, collections, épingles, tags, idées, plein écran, sélection multiple | Les inspirations d'un projet restent liées à celui-ci ; la gestion physique des médias est commune |
| Documentation | Articles, tutoriels, catégories, recherche, édition avec photos et vidéos | Absente de certaines listes : ne pas la supprimer par omission |
| Downloads | États en attente, en cours, terminé, échoué ; historique ; Instagram vers MP4 ; Cobalt | Panneau secondaire et application complète partagent le même état ; Cobalt à confirmer |
| Tools | Rangs raccourcis, échantillon, règle de trois, grilles de points, patron depuis photo, calculatrice, notes, journal | Compteur, chronomètre et notes deviennent des services réutilisables avec contexte métier explicite |
| Settings | Apparence, thèmes, polices, fonds d'écran, verrouillage, multi-IA, stockage, sauvegarde | Synchronisation et compte sont des rubriques cibles, pas des services attestés ; Theme Manager utilisable seul |

Services partagés à extraire en plus de ceux de la Phase 2 : File Manager, Theme Manager, Search Manager, compteur et chronomètre, générateur d'identifiants stables, préparation du Sync Manager (sans le présumer opérationnel). Règles : les applications appellent les services et ne modifient jamais les variables privées des autres ; Projects sauvegarde par Storage, PDF Reader obtient ses documents par Media, Patterns sollicite AI, Library utilise les services de fichiers.

Sortie du jalon : chaque module se comporte comme avant (patrons et projets complets, PDF avec leurs repères et compteurs, outils et journal préservés), sans doublon métier involontaire ni écriture concurrente.

### Jalon 4 — Desktop Engine

**Mise à jour du 19 novembre.** Ce jalon, tel que décrit ici, est remplacé : le jalon 4 du laboratoire est « Propriété des données ». Le Window Manager, le Tab Manager et le Session Manager ne sont à construire que si la maquette montre des fenêtres multiples.

Objectif : construire le moteur du bureau et définir ses contrats et son état avant toute interface. Il s'appuie sur les services du jalon 2.

- **Core, State, Router** : initialisation, cycle de vie, destinations, ressources et historique.
- **Window Manager** : ouverture, fermeture, réduction, superposition, activation ; déplacement borné à l'écran sur PC ; dimensions minimales ; redimensionnement libre seulement s'il apporte un bénéfice ; confirmation avant fermeture avec modifications non enregistrées. Les états cités (Closed, Open, Minimized, Maximized, Active) sont décomposés en visibilité, mode d'affichage et focus (proposition de clarification, pas un modèle déjà implémenté).
- **Tab Manager** : chaque onglet a son état, son identification active et sa fermeture individuelle ; réorganisation sur PC, sélecteur compact sur mobile ; pas d'onglets dupliquant une même ressource.
- **Session Manager** : au démarrage, Restore session (applications, onglets, ressources actives, fenêtres secondaires, disposition) ou Start fresh (bureau sans restauration). Les données enregistrées restent intactes dans les deux cas, les brouillons sont protégés indépendamment, et la session ne remplace jamais la sauvegarde.

| Application | Onglets prévus |
| --- | --- |
| Home, Downloads, Settings | Pas d'onglets de ressources |
| Patterns | Dossiers et patrons ouverts |
| PDF Reader | Plusieurs PDF |
| Library | Collections ou ressources |
| Quick Notes | Fenêtre ou panneau secondaire |
| Projects, Documentation | À préciser, sans supprimer l'état existant |

Sortie du jalon : états d'onglets conservés et fermeture individuelle ; fenêtres ouvertes, réduites, restaurées et superposées correctement ; restauration de session sur demande sans altérer les données ; les applications principales ne sont pas détruites lors d'un changement de section.

### Jalon 5 — Bureau

**Mise à jour du 19 novembre.** Le lanceur, l'explorateur à groupes et la barre des tâches décrits ici ne figurent pas dans les composants du nouveau thème (barre du haut, barre du bas, fenêtres, volets). À confirmer avec la maquette avant de les construire.

Objectif : ajouter l'interface système avec des composants communs. Le bureau est un point d'accès, jamais un second inventaire des données : raccourcis et explorateur ouvrent les mêmes identifiants.

- **Launcher** : ouverture par Start, recherche filtrée, favoris, toutes les applications et applications récentes, accès aux paramètres et à la fermeture de session, fermeture par Échap ou clic extérieur ; la recherche globale retrouve aussi patrons, dossiers et fichiers.
- **Explorer** : groupes repliables MAIN (Home, My workspace, Recent, Favorites), MY CREATIVE SPACE (Patterns, Library, Projects), TOOLS (PDF Reader, Downloads, Media), SYSTEM (Settings, Theme manager, About dreamOS) ; réductible avec infobulles et indicateur actif ; précédent / suivant, fil d'Ariane et raccourcis clavier selon le routage réel. Media, Theme manager, Recent et Favorites sont des vues sur des services, pas de nouveaux silos de données.
- **Home** : raccourcis personnalisables, reprise du dernier patron, projets et activité récente, widgets facultatifs.
- **Barre système et barre des tâches** : Start, recherche, actions rapides, notifications, horloge ; applications ouvertes et active, fenêtres réduites ; fixe sur PC, simplifiée ou adaptée sur tablette et iPhone, sans jamais recouvrir le contenu ni provoquer de saut de défilement.
- **Bibliothèque de composants communs** : fenêtres, barres de titre, boutons (normal, survol, actif, désactivé), dossiers, fichiers, menus contextuels, dialogues, notifications, barres d'outils, widgets.

Décision préalable : le placement final de Start et de l'horloge, présents dans les deux barres selon les sources.

Sortie du jalon : le launcher recherche et lance correctement applications et contenus ; sidebar, raccourcis et navigation sans perte de contexte ; la barre des tâches reflète les applications, l'application active et les fenêtres réduites.

### Jalon 6 — Intégration

**Mise à jour du 19 novembre.** Une partie de ce jalon (transférer la propriété des écritures) est déjà en cours sous le nom de jalon 4. Le reste (brancher chaque écran sur la nouvelle coquille) est repris par l'habillage écran par écran du nouveau jalon 5.

Objectif : brancher les applications au nouveau bureau une par une, en conservant liens métier, contexte et anciens exports / imports. L'ancien moteur (`app.js`, `app-late.js`) n'est supprimé que lorsque toutes ses responsabilités sont migrées et testées.

- Pour chaque application : l'ouvrir dans le Workspace, vérifier son comportement d'onglets, son état à la navigation et la conservation du contexte lors d'un changement d'application, puis valider avant de passer à la suivante.
- Transférer progressivement la propriété des écritures de l'ancien moteur vers les services, une ressource à la fois, avec une seule autorité d'écriture.
- Rendre les outils secondaires (Quick Preview, Properties, Quick Notes, panneau de téléchargement, confirmations) cohérents : fenêtres flottantes sur PC, panneaux sur tablette et iPhone. Le Mini Player n'existe que si sa présence est confirmée.

Sortie : toutes les applications fonctionnent dans le bureau, y compris les fonctions historiques (compteurs, marqueurs PDF, journal, Instagram, sauvegardes) ; aucune fonction existante n'a disparu sans inventaire.

### Jalon 7 — Validation fonctionnelle

Objectif : tester les fonctions existantes, les données, les sauvegardes, les sessions et les trois formats d'écran. Les critères ci-dessous sont des exigences à vérifier, aucun n'est déjà validé.

| Domaine | Critère de validation |
| --- | --- |
| Launcher | Recherche et lancement corrects des applications et contenus |
| Navigation | Sidebar, raccourcis et navigation sans perte de contexte |
| Onglets | État conservé, fermeture individuelle, onglet actif identifiable |
| Taskbar et fenêtres | Ouverture, fermeture, réduction, restauration et superposition correctes |
| Session | Restauration sur demande, sans altérer les données enregistrées |
| Patrons et projets | Dossiers dépliables, fiches, liens, statuts ; projets complets |
| PDF | Repères, marque-pages, annotations, compteurs et outils préservés |
| Downloads | Fonctions existantes (dont Instagram, Cobalt si confirmé) opérationnelles |
| Outils | Notes, objectifs, compteurs, marqueurs et journal préservés |
| Paramètres | Thèmes, préférences, multi-IA et sauvegardes fonctionnels |
| Données | Aucune perte ni duplication involontaire ; anciennes sauvegardes compatibles ou convertibles |
| Responsive | PC, tablette et iPhone utilisables sans recouvrement ni saut de défilement |

**Scénarios de non-régression de référence**

1. Un patron créé avant la migration reste disponible.
2. Un projet conserve ses fils, ses photos et son journal.
3. Les compteurs de rangs ne sont pas remis à zéro.
4. Les marqueurs PDF restent associés à leurs documents.
5. Les favoris et dossiers restent identiques.
6. Les paramètres visuels restent disponibles.
7. Les clés IA restent configurées.
8. Les tableaux d'inspirations restent intacts.
9. Les fichiers multimédias restent accessibles.
10. Une sauvegarde créée avant la migration peut être restaurée après.

**Scénarios prioritaires supplémentaires** : créer un patron avec PDF et photo, l'ajouter à un dossier puis à un projet et le retrouver par recherche ; ouvrir deux PDF, annoter et compter des rangs sur l'un, changer d'application puis vérifier chaque état à la reprise ; démarrer et arrêter le chronomètre, ajouter journal et inspiration, sauvegarder puis restaurer sur un jeu de test ; réduire Quick Notes, la rouvrir via la barre des tâches et tester la fermeture avec brouillon ; relancer avec restauration puis session vierge ; tester suppression réversible, suppression directe et récupération ; tester installation, coupure réseau, affichage mobile, thème, PDF et dépendances.

Sortie : tous les critères ci-dessus vérifiés sur PC, tablette et iPhone réels, sur un profil de test.

### Jalon 8 — Refonte visuelle Bliss

**Mise à jour du 19 novembre.** Ce jalon passe en premier et devient le jalon 5 (habillage Bliss rose écran par écran, voir le début de cette section). Les valeurs de couleur ne sont plus indicatives : elles sont dans `tokens.css`, estimées depuis tes maquettes.

Objectif : appliquer l'identité finale une fois la structure et les composants stabilisés.

- Valider la palette Bliss (contrastes, couleurs fonctionnelles, lisibilité) : la palette de l'annexe n'est qu'indicative.
- Appliquer le thème aux fenêtres, boutons, icônes, textures, reliefs et bordures ; un système de thèmes extensible permet d'ajouter d'autres thèmes qui modifient aussi ressources, textures et bordures.
- Créer les icônes et illustrations définitives (langage graphique personnalisé, aucun emoji comme icône d'interface) ; les animations décoratives viennent après validation de l'ergonomie.
- Pas de CSS correctif ajouté en fin de fichier : consolider les couches (`reset`, `variables`, `structure`, `components`, `responsive`, `themes`) et réduire les `!important`.

Sortie : un thème Bliss cohérent sur les trois formats d'écran, sans régression fonctionnelle.

### Après les 8 jalons : pistes différées

Ces éléments sont hors périmètre initial et ne doivent pas retarder l'architecture principale : WIP Island (atelier vivant avec projets sur une île, progression de sessions, animaux réactifs, décorations à débloquer, journal de souvenirs), XP et récompenses (phase ludique séparée), synchronisation cloud complète (le Sync Manager est seulement préparé), widgets météo et lecteur musical, format de sauvegarde v2 (manifeste, sommes de contrôle, métadonnées de version).

## 7. L'appli finale : à quoi elle ressemblera

Tu peux la voir avant qu'elle existe : [la maquette de l'appli finale](https://claude.ai/artifact/KF6Lban5wBWyRkboGJFvoH) montre le bureau en thème Bliss sur PC, trois autres thèmes (Doodle, Classique 95, Pixel RPG) et la même appli sur iPhone. Toutes les données y sont des exemples, et ce n'est pas encore du code : c'est une image fidèle de l'intention.

- Sur PC, tu ouvres le site et tu arrives sur un bureau : icônes, fenêtres que tu déplaces, barre des tâches, notification « Sauvegarde terminée », indicateur « Synchronisé ».
- Tes outils (compteur, rangs, notes) sont de vraies fenêtres que tu peux garder ouvertes à côté de ton patron.
- Sur iPhone, la même appli se replie en une seule colonne, avec une barre de navigation en bas ; ce n'est pas une autre application.
- Rien ne bascule d'un coup : l'appli actuelle reste utilisable à chaque jalon, et tu valides l'aspect avant qu'on l'applique partout.

**Mise à jour du 19 novembre.** Ta version retravaillée du design remplace la maquette que je t'avais montrée. Elle respecte des règles que ma maquette enfreignait : pas de pourcentage de progression (j'affichais « 35 % »), pas de texte « Synchronisé » tant que la synchronisation n'existe pas, et des statuts (En attente, WIP, Terminé) réservés aux projets, pas aux patrons. Ces trois points sont à corriger dans tout ce que j'ai produit avant.

**Navigation cible, d'après ton thème.**

- Sur PC : une barre du haut (logo dreamOS, recherche, actions, pastille d'état) et, dessous, des écrans présentés comme des fenêtres. La barre de titre est bleue par défaut, verte pour un projet WIP et jaune pour un projet Terminé. Les boutons Réduire, Agrandir et Fermer ont une icône et un nom.
- Sur téléphone : une barre du bas à 5 entrées (Bibliothèque, Projets, Idées, Outils, Plus), des volets qui montent du bas de l'écran et, dans les idées, une barre de sélection.
- Sur tablette (834 px) : le même modèle, avec des cibles tactiles d'au moins 44 px.
- Le lecteur PDF a une ligne de rang déplaçable avec une poignée et un compteur flottant (−, valeur, +1).

C'est une lecture des fichiers de thème : elle sera validée avec ta maquette.

## 8. Synchronisation entre appareils

**Constat.** Aujourd'hui, tes données vivent dans le navigateur de l'appareil (localStorage et IndexedDB), et le site est hébergé de façon statique sur GitHub Pages, sans serveur. Ouvrir le site sur un autre PC montre donc une appli vide : rien ne voyage. La seule passerelle actuelle est la sauvegarde ZIP.

**Ce qu'il faut décider.** Les options ci-dessous sont des propositions à valider, pas des choix déjà faits.

- Option A, sauvegarde manuelle améliorée : tu exportes sur un appareil et tu importes sur l'autre. Aucun serveur, aucun coût, mais ce n'est pas de la synchronisation.
- Option B, un fichier dans ton propre cloud (Drive, OneDrive, iCloud) : peu de dépendances, mais dépend des capacités du navigateur et reste fragile avec les gros fichiers.
- Option C, un compte avec un petit serveur (par exemple Supabase ou Firebase) : la vraie synchronisation automatique, y compris PDF et photos. Elle demande un compte, un hébergement externe, une gestion de la vie privée et des conflits.

**Recommandation.** Commencer par A (renforcée), puis passer à C quand les jalons 3 et 4 sont stables. A reste ensuite comme filet de sécurité.

**Ce que cela implique techniquement.**

- Chaque patron, projet et note reçoit un identifiant stable et une date de dernière modification (à préparer dès le jalon 3).
- Règle de conflit à choisir : « le plus récent gagne » par élément, avec conservation de l'ancienne version en cas de doute.
- Les clés API des fournisseurs d'IA ne sont jamais synchronisées en clair.
- Le format de sauvegarde v1 doit rester restaurable ; thème, réglages et favoris d'auteurs, absents du ZIP aujourd'hui, seraient à inclure dans un format v2.
- Un jalon dédié, « Jalon 9 — Synchronisation », est proposé après la refonte visuelle. Le schéma de la section 6 ne le montre pas encore.

## 9. Thèmes

**Principe.** Un thème change l'apparence, jamais le comportement : couleurs, polices, bordures, textures, icônes et décor. Tous les thèmes sont pensés pour l'ordinateur d'abord ; le téléphone reprend les mêmes jetons visuels. L'application possède déjà un mode « dreamOS (Windows rétro) » avec six palettes (Ciel, Cyberpop 98, Retro Dream, Pixel Dream, Bliss 95, Nuit) : c'est la base à faire évoluer, pas un point de départ.

**Cinq familles tirées de tes images d'inspiration.**

- A, Bliss / DreamWorld : rose et menthe pastel, pixel art, fenêtres Windows 98 douces. Thème de référence.
- B, Doodle : contours épais dessinés à la main, aplats colorés, barres de stats.
- C, Classique 95/98 : gris biseauté, barre de titre bleu marine, bureau turquoise.
- D, Néobrutalisme / Y2K pop : couleurs vives, ombres dures, gros boutons.
- E, Pixel RPG : bleu nuit et rose, inventaire en cases, barres de vie et d'expérience.

La maquette montre A, B, C et E ; D reste à dessiner. Idées pour E : la progression d'un projet devient une barre d'expérience, et la réserve de laine et d'aiguilles un inventaire en cases.

**Règles pour que ça tienne.** Tout est piloté par des variables de couleur et de forme, jamais par des couleurs écrites en dur. Contraste de texte vérifié dans chaque thème. Un thème peut remplacer les icônes, mais les noms et les emplacements ne bougent pas. Le choix du thème est mémorisé (et sauvegardé, voir section 8).

**Livraison du thème (19 novembre).** Tu as fourni `tokens.css` (variables), `components.css` (composants préfixés `dos-`), 60 icônes SVG avec un sprite et un `CLAUDE.md` de consignes. Règles : aucune couleur ni ombre en dur, aucun `!important`, cibles tactiles d'au moins 44 px, contraste d'au moins 4,5 contre 1. Attention aux identifiants : le thème s'appelle `bliss` dans les nouveaux fichiers, alors que le code actuel enregistre `carnet.theme = dreamos` avec des palettes (dont `bliss95`) ; il faut une correspondance pour que les réglages déjà enregistrés continuent de marcher.

**Contenu du pack de thème.**

- Variables (`tokens.css`) : palette rose (fond, surface, encre, accent, rose, bleu, vert, jaune, lilas), rôles de statut (En attente rose clair, WIP vert, Terminé jaune), contours d'1 px, rayons de 6 à 16 px, ombres dures « XP mais mignon », échelle d'espacement de 4 px, cibles tactiles de 44 et 48 px, titres en Pixelify Sans et texte en DM Sans. Les valeurs sont estimées depuis les maquettes et à confirmer.
- Composants (`components.css`, préfixe `dos-`) : boutons, champs, segment de statut, onglets, barre du haut, barre du bas, pastille de synchronisation, fenêtres, panneaux, chips et tags, résultats d'outils, notes, jauges, lecteur PDF avec ligne de rang et compteur, volet mobile, tableau d'idées en colonnes, barre de sélection.
- Icônes : 60 SVG et un sprite (par exemple fil, pelote, chrono, calculatrice, règle, grille, caméra, micro, punaise, filtre, nuage). Elles remplacent les emoji de l'interface actuelle.
- Seules deux polices sont nécessaires, alors que la page actuelle en charge sept.

## 10. Diagnostic UI/UX et principes de refonte

**Ce que j'ai observé en ouvrant le laboratoire dans un navigateur de bureau et en simulation iPhone.**

- Sur PC, l'interface est une fenêtre unique au centre avec beaucoup de place perdue autour.
- La barre d'onglets du bas (Patrons, Projets, Outils, Doc, Idées, Réglages) est celle d'un téléphone, même sur ordinateur.
- Sur iPhone, certains textes sont tronqués et certaines cartes trop grandes.
- Les icônes de l'interface sont des emoji, alors que le principe du projet les exclut.
- Une police à chasse fixe sert partout, ce qui fatigue la lecture des longs textes.
- Sept polices Google sont chargées, ce qui alourdit le chargement.

**Principes de refonte.**

- Le PC est la référence : bureau, fenêtres déplaçables, barre latérale, barre des tâches. Le téléphone s'adapte ensuite.
- Une police d'interface lisible pour le texte, une police pixel réservée aux titres et aux petits détails.
- Un seul jeu d'icônes dessiné, en SVG, qui change avec le thème.
- Une échelle d'espacement et de tailles unique, pour éviter les débordements.
- Contraste vérifié (texte courant au moins 4,5 contre 1) ; un bouton rose clair avec du texte blanc ne passe pas, il faut un rose plus foncé.
- Des états vides, des chargements et des erreurs toujours visibles et expliqués.

## 11. Améliorer les outils

Tes outils sont le cœur de l'appli : on les garde, on les fait vivre dans des fenêtres. Les pistes ci-dessous sont à valider avec toi, outil par outil.

**Boîte à outils globale (7 outils existants).**

- Rangs raccourcis, Convertisseur d'échantillon, Règle de 3 et Calculatrice : des calculs dont le résultat pourrait être ajouté au journal d'un WIP.
- Depuis une photo et Grilles de points : outils de création (montage sur mesure, diagrammes jacquard, dentelle, torsades).
- Télécharger une vidéo (Cobalt) : enregistrement sur l'appareil ou dans Documentation ; la clé n'est jamais journalisée.
- Trois modules annoncés « à venir » dans ta maquette : Laboratoire de teinture, Chromatique et Atelier des fils (laine, inventaire, liste de souhaits, encyclopédie textile).

**Outils d'un WIP.** Compteurs, Chrono, Journal, Marqueurs et Matériel, en accès rapide sur la fiche (voir les décisions ci-dessous).

*Correction du 19 novembre : la première version de cette section citait un compteur, un chronomètre et une calculatrice comme outils à améliorer, sans avoir vérifié ta vraie liste. Elle est remplacée par la liste ci-dessus.*

### Fiche WIP : décisions validées

**Disposition de la page principale, de haut en bas.** 1. Boîte « Patron lié ». 2. Statut du projet (En attente, WIP, Terminé). 3. Statistiques existantes, plus petites, sur une seule ligne : statut, durée depuis le début, temps tricoté au total, rangs comptés, pelotes utilisées. 4. Accès rapide aux outils, en icônes sur une ou deux lignes. 5. Outil ouvert, dans la page, sans cacher le reste.

**Structure.**

- Deux onglets : « Suivi du projet » (vue d'ensemble, patrons et documents, suivi et compteurs, matériel) et « Journal, galerie et souvenirs » (avec l'entretien pour les projets terminés).
- Cartes repliables, par exemple le matériel et les dernières entrées du journal.
- Plus d'onglet « Outils » dans la fiche, plus de boîte indépendante « Photo de couverture » : les commandes photo (dont « + Nouvelle photo ») passent dans « Patron lié ». La fiche doit devenir beaucoup moins haute.
- Une apparence différente selon le statut. Un projet terminé devient un carnet souvenir (la page du projet Terminé), avec ses statistiques.

**Patrons et documents.**

- Plusieurs patrons et plusieurs PDF par WIP ; PDF réorganisables ; supprimer un PDF ne supprime pas son patron ; pas de PDF principal.
- Un clic sur la photo de couverture ouvre la liste des patrons associés pour choisir.
- Pour un patron personnel, un vrai éditeur de texte (titres, gras et italique, listes, tableaux, images, sauvegarde automatique, plusieurs sections) avec export PDF. Les documents texte apparaissent dans la liste des documents du WIP, à côté des PDF, avec la question « Modifier ? » avant de pouvoir écrire dedans.
- Le fonctionnement actuel des PDF est conservé pour le moment.

**Compteurs.**

- Rangs, tours, répétitions, mailles et compteurs libres ; nom et valeur de départ personnalisables ; objectif facultatif ; couleurs attribuées automatiquement ; aucun pictogramme ; valeurs négatives interdites ; remise à zéro.
- Masquer : le compteur reste invisible dans le panneau avec sa valeur et son objectif. Archiver : il peut être réactivé avec son ancienne valeur. Confirmation avant suppression, avec possibilité d'annuler.
- Sur iPhone, un tiroir inférieur repliable ; sur PC, un petit panneau flottant déplaçable et redimensionnable. Taille, position et état sont mémorisés pour chaque WIP.

**Chronomètre et journal.**

- Démarrage manuel ; confirmation quand on change de WIP pendant une session ; historique des sessions dans le journal ; durées modifiables à la main.
- Journal avec texte, photos, date automatique, compteurs et notes vocales (un simple bouton de lecture).
- Aucune entrée automatique : tu as répondu non à toutes les actions proposées (objectif atteint, session terminée, remise à zéro, pelotes, matériel, ajout de patron). À clarifier, car ta décision de départ disait que certaines actions créent une entrée.

**Matériel, photos et souvenirs.**

- Pas de fiches détaillées de laine pour le moment ; plusieurs aiguilles par projet ; couleurs avec code hexadécimal et emplacement dans le projet.
- Deux catégories de photos : Inspirations et Photos ; couverture indépendante de la galerie ; pas de comparaison côte à côte.
- Le système des pelotes avec l'emoji qui augmente le nombre utilisé ne change pas. WIP Island ne change pas non plus.
- Pas de suivi d'entretien à étapes, pas de compteurs en lecture seule après la fin du projet.
- « Stitch markers » devient « Marqueur » (singulier).

**Règle pour tout le chantier.** On ne supprime aucune fonctionnalité existante simplement parce qu'on réorganise l'interface. On distingue toujours la suppression visuelle, la désactivation et la suppression réelle des données.

**Conséquence sur les données.** Compteurs multiples et archivés, matériel, catégories de photos et documents texte ajoutent des champs aux projets. Ils doivent faire l'objet d'une seule évolution additive, décidée avant l'étape 4.6c, pour ne pas écrire deux fois le module Projects.

## 12. Mac et Android

Prévu pour plus tard, sans impact sur les jalons actuels.

- Mac : le site fonctionne déjà dans Safari ou Chrome ; la voie la plus simple est une appli web installable (PWA), puis éventuellement une application de bureau empaquetée.
- Android : la PWA s'installe depuis Chrome ; un empaquetage en application native est possible si besoin.
- Ce qui rend la suite facile : rester sur des technologies web standard, éviter les fonctions propres à un seul navigateur, et fabriquer la synchronisation (section 8) en premier, car c'est elle qui relie tous les appareils.
- À tester à chaque étape : enregistrement hors ligne, gros fichiers, ouverture des PDF.

## 13. Risques, décisions ouvertes et écarts entre sources

Le risque dominant est la perte ou la corruption de données pendant la migration ; les mesures ci-dessous le couvrent, et plusieurs décisions restent à trancher par toi (la liste ci-dessous, puis les questions de la fin de cette section).

**Risques et mesures préventives**

| Risque | Mesure préventive |
| --- | --- |
| Double écriture ancien moteur / nouveau service | Une seule autorité d'écriture par ressource |
| Perte de données | Copies de secours, tests sur profil isolé, jamais sur les vraies données |
| Import ES manquant | Test de complétude du graphe de dépendances (précache) |
| Cache obsolète | Versionnement du Service Worker |
| URL média inutilisable ou fuite mémoire (iPhone) | Gestion centralisée des Object URLs |
| Erreur de restauration | Validation préalable du ZIP, jamais de suppression avant validation complète |
| Régression PDF | Tests sur annotations, repères et compteurs |
| Incompatibilité iPhone | Tests tactiles et viewport réels |
| Clés API exposées | Ne jamais les journaliser ni les inclure dans les notifications ; prévoir un backend sécurisé si besoin |
| Migration interrompue | Chaque jalon produit une version identifiable ; retour arrière sans effacer IndexedDB |

**Décisions à prendre**

- [ ] Sauvegarde : faut-il inclure thème, favoris d'auteurs, clés IA et mot de passe, ou les laisser à reconfigurer (confirmé absents du ZIP en Phase 2.8) ? Un format v2 (manifeste, sommes de contrôle) est reporté après la Phase 2.
- [ ] Clés API : stockage actuel conservé, chiffrement, ou backend sécurisé ?
- [ ] Serveur Instagram : rendre l'authentification obligatoire si exposé au réseau ou par tunnel.
- [ ] Cobalt et WIP Island : existence et comportement à confirmer dans le code ; ne rien supprimer avant.
- [ ] Onglets de Projects et Documentation : comportement à préciser.
- [ ] Placement final de Start et de l'horloge (barre système, barre des tâches ou les deux).
- [ ] Fréquence et moment d'enregistrement de la session (« à la fermeture » n'est pas un mécanisme vérifié).

**Écarts entre les sources**

| Sujet | Écart | Choix retenu dans cette documentation |
| --- | --- | --- |
| Numérotation des phases | 6 phases (document fondateur), 8 jalons (document consolidé), Phase 2 en sous-étapes 2.0 à 2.8 (spécification) | Les 8 jalons forment la ligne principale ; le jalon 2 contient les sous-étapes 2.0 à 2.8 |
| Arborescence cible | Trois arbres différents (fondateur, consolidé, spécification) ; le labo utilise un dossier `dreamOS/` à plat | Arbre unique à ajuster après la Phase 2, sans tout déplacer d'un coup |
| Fournisseurs IA | 5 dans le catalogue ; 2 adaptateurs dans le labo | Catalogue complet conservé ; couverture des 5 à tester en 2.8 |
| Nom du cache Service Worker | La spécification suggère `dreamos-phase2-v1` ; le labo garde `atelier-tricot-v10` | Nom historique conservé, version incrémentée à chaque jalon |
| WIP Island | Hors périmètre initial (fondateur) ; illustrations précachées par le Service Worker actuel | Préserver l'existant, différer la refonte |

### Conflits entre le nouveau design, la documentation et le code (19 novembre)

1. **Numérotation.** La documentation d'origine place le Desktop Engine au jalon 4 ; le laboratoire y a mis la propriété des données. Proposition : suivre le laboratoire (plan révisé, début de la section 6).
2. **Modèle de navigation.** La documentation décrit un bureau (lanceur Start, explorateur à groupes, barre des tâches, onglets et session). Les composants du nouveau thème décrivent une barre du haut, une barre du bas à 5 entrées, des fenêtres et des volets. Le code actuel a une fenêtre unique et une barre à 6 onglets (Patrons, Projets, Outils, Doc, Idées, Réglages). Les trois ne coïncident pas : la barre du bas passe de 6 à 5 entrées (tu m'avais indiqué : Bibliothèque, Projets, Idées, Outils, Plus), ce qui suppose que Doc et Réglages passent sous « Plus ».
3. **Ordre des travaux.** La documentation met le visuel en dernier (ancien jalon 8). Tes consignes de thème vont dans l'ordre inverse : variables, composants, écran par écran, fonctions nouvelles en dernier. Proposition : suivre tes consignes.
4. **Identité visuelle.** La palette de l'annexe est remplacée par `tokens.css` (valeurs estimées, à confirmer). Le code enregistre `dreamos` avec 6 palettes ; le nouveau thème s'appelle `bliss` ; les trois thèmes prévus (Doodle, Classique 95, Pixel RPG) devront passer par les mêmes variables.
5. **Règles de contenu.** Pas de pourcentage de progression, pas de texte « Synchronisé » avant la synchronisation, statuts réservés aux projets. Ma maquette et les premières sections de cette documentation les enfreignaient en partie. Ta décision d'une « petite barre de progression » dans la fiche WIP est à accorder avec la règle « aucun pourcentage » (une barre sans chiffre ?).
6. **Fournisseurs d'IA.** Le code a 5 fournisseurs (Gemini, Groq, OpenRouter, OpenAI, OmniRoute) et 2 adaptateurs. Ta spécification en liste 5 autres : Claude, Gemini, Grok, OmniRoute, ChatGPT. Il faut peut-être distinguer Groq (Llama) de Grok (xAI), et un adaptateur Claude n'existe pas encore.
7. **Dette CSS.** Environ 280 `!important` (43 dans `styles.css`, 14 dans `styles-late.css`, 225 dans `themes/bliss.css`) et des couleurs en dur, que le nouveau thème interdit. L'ancien CSS ne peut être retiré qu'écran par écran, après validation.
8. **Rendu dans `app.js`.** Les 10 vues sont des gabarits de texte dans `app.js` et plusieurs tests lisent le code source. Toucher aux gabarits est autorisé pour la structure et les classes seulement, et chaque écran doit relancer tous les tests.
9. **Fonctions nouvelles et données.** Carte Reprendre, file d'imports, note vocale, Marqueurs, Matériel, compteurs multiples et éditeur de patron changent ou ajoutent des données, alors que les consignes interdisent de changer le format des données et de la sauvegarde. Règle proposée : évolutions additives seulement, sauvegarde v1 toujours restaurable.
10. **Dossier `assets/`.** Absent des zips depuis la phase 2.8, donc icônes et images de l'île manquantes dans mes tests (voir les décisions du 19 novembre, dans la section 6).

### Questions à trancher

- La maquette montre-t-elle des fenêtres multiples, un lanceur ou une barre des tâches ? Sinon, on abandonne le Desktop Engine et le Bureau d'origine.
- Barre du bas : confirmer que Doc et Réglages passent bien sous « Plus » (Bibliothèque, Projets, Idées, Outils, Plus).
- Texte de la pastille d'état avant la synchronisation.
- Liste finale des fournisseurs d'IA et rôle d'OmniRoute.
- Compteur « principal » d'un projet : le premier non archivé, ou celui que tu épingles ?
- Valeurs de couleur définitives de `tokens.css`.
- Étape 4.6c : la lancer avant l'habillage ou attendre la décision sur les données de la fiche WIP (je conseille d'attendre) ?

## 14. Annexes

**Glossaire**

| Terme | Sens |
| --- | --- |
| IIFE | Fonction anonyme auto-exécutée qui encapsule `app.js` : ses variables ne sont pas accessibles aux modules |
| ESM | ES Modules natifs (`import` / `export`), sans bundler |
| Legacy Adapter | Pont limité entre l'ancien moteur et les nouveaux services |
| Service Registry | Registre d'instances uniques des services |
| Event Bus | Diffusion d'événements entre composants sans dépendance directe |
| Object URL | URL temporaire créée par `URL.createObjectURL()`, à révoquer quand elle ne sert plus |
| Miroir / instantané | Copies de secours des patrons : `persist`, `persistNow`, `safetySnapshot` |
| Bliss | Thème de référence, dominante rose poudré |
| Workspace | Zone principale affichant l'application active |

**Palette Bliss de travail (indicative, à valider)**

| Nom | Code | Intention |
| --- | --- | --- |
| Cotton | #F8DCE8 | Rose très clair |
| Blush | #EFAACB | Rose poudré |
| Berry | #D95A91 | Rose soutenu |
| Dream | #B8C6E8 | Bleu lavande |
| Mint | #B9D8C1 | Vert menthe |
| Butter | #F5DDAA | Jaune crème |
| Vintage | #C5B5A8 | Neutre chaud |
| Ink | #30252C | Texte foncé |

**Sources utilisées**

- dreamOS — Documentation fondatrice : architecture et audit (12 pages, v1.0).
- dreamOS — Documentation complète consolidée v2.0 (17 pages, 18 novembre 2026).
- dreamOS — Spécification technique v1.0 (20 pages, 17 novembre 2026).
- dreamOS — archive du laboratoire Phase 2.8 (code, tests et notes des phases 2.6, 2.7 et 2.8). Les tests Node des phases 2.1 à 2.5 et le test de précache ont été relancés pour cette documentation ; les autres n'ont pas pu l'être.
