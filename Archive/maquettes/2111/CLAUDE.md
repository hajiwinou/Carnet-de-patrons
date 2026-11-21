# dreamOS — consignes pour remplacer le thème (Bliss rose)

## Objectif
Remplacer l'ancien habillage (bleu façon Windows XP : `themes/bliss.css`, `styles.css`,
`styles-late.css`) par le nouveau thème Bliss rose, « XP mais mignon », écran par écran,
**sans changer le comportement de l'application**. Un thème change l'apparence, jamais le comportement.

## Sources de vérité
- Maquettes (PC, mobile, tablette) : https://claude.ai/artifact/LPBv8kaWtZekPZ7W1eKE4e
- Spécification fonctionnelle (36 fiches, arborescence, règles) : https://claude.ai/artifact/NL1Q2SoF67N9yq58RPzJkQ
- Variables : `theme/tokens.css` · Composants : `theme/components.css` · Icônes : `icones/` (SVG + sprite)
- En cas de conflit : spécification > maquette > ancien code. Si une règle manque, **demander**, ne pas deviner.

## Règles de code (non négociables)
1. **Aucune couleur, ombre, rayon ou police en dur.** Tout passe par les variables de `tokens.css`.
2. **Aucun `!important`.** L'ancien CSS en compte ~300 : on les supprime avec l'ancien CSS, on ne les recopie pas.
3. Classes de composants préfixées `dos-` (voir l'en-tête de `components.css` pour la correspondance avec les maquettes).
4. Pas de style inline sauf valeur dynamique (largeur d'une jauge, position de la ligne de rang).
5. Cibles tactiles ≥ 44 px (mobile et tablette), contraste texte ≥ 4,5:1, focus clavier visible, noms (`aria-label`) sur tout bouton qui n'a qu'une icône.
6. Les boutons de fenêtre (Réduire, Agrandir, Fermer) ont une icône et un nom.
7. Pas de texte coupé : les titres longs passent à la ligne ou s'ellipsent avec un titre complet accessible.
8. Interface en français. Ne pas renommer les clés de données ni les identifiants du JavaScript.
9. Toucher au HTML généré par `app.js` n'est permis que pour la structure et les classes. Jamais pour la logique.

## Vocabulaire (à respecter dans l'interface)
- Statuts : **uniquement sur les projets** : En attente / WIP / Terminé. Les patrons n'ont pas de statut.
- **Aucun pourcentage de progression.** On affiche un compteur (« Corps · 42 / 120 »), le temps tricoté, les rangs comptés.
- Le journal est visible dans les trois pages de projet (En attente, WIP, Terminé). Il s'écrit à un seul endroit.
- Carnet souvenir = la page d'un projet Terminé (pas une entité séparée).
- Lecteur PDF : boutons Repère (punaise), Surligner (crayon), **Marqueur** (rond rouge), Mes outils.
- Pastille d'état des données : tant que la synchronisation n'existe pas, ne pas écrire « Synchronisé ». (Texte à décider.)
- Analyse IA (bêta) : fournisseurs Claude, Gemini, Grok, OmniRoute, ChatGPT. Les clés ne sont pas dans la sauvegarde ZIP.

## Méthode, dans cet ordre
1. **Couche de variables** : charger `tokens.css`, vérifier que le thème actif est `bliss`.
2. **Composants** : charger `components.css`, créer une page de test interne qui montre chaque composant dans chaque état.
3. **Écran par écran**, dans l'ordre de la spécification : barre du haut, Bibliothèque, Projets, Fiche patron, Lecteur PDF, Outils, Idées, Réglages, formulaires, états vides.
   Pour chaque écran : remplacer le HTML/CSS, supprimer l'ancien CSS devenu inutile, lancer la liste de contrôle ci-dessous.
4. Restaurer `assets/` et `themes/` (manquants dans le dernier zip), vérifier `sw.js` et le cache.
5. Ajouter les thèmes Doodle, Classique 95 et Pixel RPG **en ne modifiant que des variables**.
6. Fonctions nouvelles (carte Reprendre, file d'imports, note vocale, onglets Marqueurs et Matériel, éditeur de patron) : dernière étape, une par une.

## Liste de contrôle par écran
- [ ] Rendu comparé à la maquette (PC 1280, tablette 834, téléphone 390 ; tester aussi 360).
- [ ] Aucun texte coupé ou qui touche le bord de son bandeau.
- [ ] Navigation au clavier (Tab, Entrée, Échap) et focus visible.
- [ ] Boutons ≥ 44 px sur mobile et tablette.
- [ ] États : normal, survol (souris), focus, appuyé, désactivé, erreur, vide, chargement.
- [ ] Aucune couleur en dur, aucun `!important` : `grep -rn "!important\|#[0-9a-fA-F]\{3,6\}" css/` hors `tokens.css`.
- [ ] La restauration d'une sauvegarde ZIP de test fonctionne et les données s'affichent.
- [ ] Les polices sont chargées avec un repli (Pixelify Sans, DM Sans, puis polices système).
- [ ] Aucun changement de comportement : compteurs, chrono, journal, import, export se comportent comme avant.

## Outils (les 7 + la boîte à outils) : règles communes
Détail dans la section 13 de la spécification. À respecter pour chaque outil :
- Barre de contexte : retour à la boîte à outils, favori (`aria-pressed`), aide, choix du projet concerné.
- Le projet choisi préremplit l'échantillon et reçoit « Ajouter au journal ».
- Champs numériques : vrais `<input>` avec boutons − et + (≥ 44 px, 48 px sur mobile), unité visible, jamais négatifs, message de validation écrit (✓ ou ✕, la couleur ne suffit pas).
- Calcul **en direct** : pas de bouton « Calculer ». « Voir le calcul » = `<details>` avec le détail.
- Actions de résultat : Copier, Ajouter au journal (sauf Cobalt et Calculatrice). Sur mobile, barre d'actions fixe au-dessus de la barre du bas.
- Historique par outil (derniers calculs réutilisables).
- Boîte à outils : recherche, filtres par catégorie, favoris, « Récemment utilisés » (nouveautés : à confirmer avant de coder).
- Ne pas inventer de logique : si le code ne sait pas faire (détection de la photo, aperçu Cobalt), l'écran reste un squelette et on demande.

## À ne pas faire
- Ne pas supprimer l'ancien CSS d'un écran avant que le nouveau soit validé.
- Ne pas ajouter de dépendance (framework CSS, bibliothèque d'icônes) sans demander.
- Ne pas modifier le format des données ni de la sauvegarde ZIP.
- Ne pas inventer de fonction qui n'est pas dans la spécification.

## Questions encore ouvertes (demander avant de coder)
- Compteur « principal » d'un projet : premier non archivé, ou épinglé par l'utilisatrice ?
- Texte de la pastille d'état avant la synchronisation.
- Rôle exact de OmniRoute dans l'analyse IA (adresse du serveur en plus de la clé ?).
- Favoris, récents et recherche de la boîte à outils : existent-ils déjà ?
- Valeurs de couleur définitives (les valeurs de `tokens.css` sont estimées depuis les maquettes).
