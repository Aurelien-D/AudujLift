# AudujLift 🏋️‍♂️🥗

Application web (PWA installable sur téléphone) de suivi **musculation** et **nutrition**, inspirée de Liftoff, Hevy, Strong, MacroFactor et Yazio.

## Fonctionnalités

### Musculation
- **Routines** personnalisées (dossiers, séries cibles, temps de repos, notes, supersets) + **programmes prêts à l'emploi** : Push/Pull/Legs, Haut/Bas, Full Body.
- **Bibliothèque de ~115 exercices en français** (muscle principal/secondaires, équipement) + création d'exercices perso. Types de mesure : poids × reps, poids du corps (+ lest), durée, cardio (distance + durée).
- **Séance en direct** : chrono, colonne « Précédent » (valeurs de la dernière séance, un tap pour les reprendre), types de séries (échauffement, normale, dégressive, échec), validation d'une série → **minuteur de repos** automatique (±15 s, vibration, son, notification), supersets, remplacement/réorganisation d'exercices, **calculateur de disques**. La séance est sauvegardée en continu (rien n'est perdu si l'appli est fermée).
- **Fin de séance** : récap (durée, volume, séries), **records personnels battus** 🏆, mise à jour de la routine en un tap.
- **Historique** avec calendrier mensuel, modification des séances passées.
- **Fiche exercice** : 1RM estimé (Epley), charge max, meilleur volume, tableau des RM 1→12, courbes de progression.
- **Rangs façon Liftoff** (Fer → Bronze → … → Titan → Légende) par exercice, par groupe musculaire et global, basés sur le ratio force / poids de corps.
- **Régularité** : objectif de séances par semaine et série de semaines 🔥.

### Nutrition
- Journal par repas (petit-déj, déjeuner, collations, dîner), anneau des calories restantes et barres de macros.
- **Scan de code-barres** avec la caméra (API native sur Android/Chrome, ZXing sur iPhone) relié à **[Open Food Facts](https://fr.openfoodfacts.org)**, la base alimentaire libre et collaborative (excellente couverture en France), + saisie manuelle du code.
- **Recherche** : ~3 400 **aliments génériques de la table Ciqual 2025 (ANSES)** embarqués dans l'appli (instantané, hors connexion) + produits de marque d'Open Food Facts (avec nouvelles tentatives quand leur serveur est surchargé).
- **Création d'aliment avec photos** du paquet et de l'étiquette, et **lecture automatique du tableau nutritionnel (OCR)** qui pré-remplit kcal, protéines, glucides, sucres, lipides, AGS, fibres et sel — avec contrôle de cohérence.
- Portions, favoris, récents, **ajout rapide** (kcal/macros), copie du repas de la veille, suivi de **l'hydratation**, Nutri-Score.
- **Calcul des besoins** (Mifflin-St Jeor × activité, objectif sèche/maintien/masse) et proposition de macros.

### Progrès
- Courbe du **poids de corps** (moyenne 7 jours, évolution hebdo), rangs, statistiques (séances/semaine, séries par muscle sur 30 jours, moyennes nutrition).

## Profils
Plusieurs personnes peuvent utiliser l'appli sur le même appareil : avatar en haut de l'accueil (ou Profil → Profil actif) pour **ajouter / changer de profil**. Chaque profil a sa propre base de données (séances, routines, journal, poids, objectifs) : aucun risque d'écraser les données de l'autre. Sur deux téléphones différents, les données sont de toute façon séparées.

## Données & confidentialité
Tout est stocké **localement sur l'appareil** (IndexedDB) : pas de compte ni de serveur. **Export/import JSON** depuis l'onglet Profil pour sauvegarder ou changer de téléphone. L'appli fonctionne hors connexion (sauf recherche/scan Open Food Facts).

## Développement

```bash
npm install
npm run dev      # serveur de dev
npm test         # tests unitaires (Vitest)
npm run build    # build de production (dist/)
npm run format   # Prettier
```

Données Ciqual régénérables avec `scripts/ciqual2json.py` à partir des fichiers XML publiés par l'ANSES sur Zenodo.

Stack : React 19 + TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), Recharts, ZXing, Tesseract.js, vite-plugin-pwa.

> La caméra (scan, photos) nécessite **HTTPS** — c'est le cas sur GitHub Pages.

## Mise en ligne (GitHub Pages)
Le workflow `.github/workflows/deploy.yml` publie l'appli à chaque push sur `main`.
Une seule fois : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
L'appli est ensuite disponible sur `https://<utilisateur>.github.io/<dépôt>/`. Sur téléphone : *Partager → Sur l'écran d'accueil* (iPhone) ou *⋮ → Installer l'application* (Android).
