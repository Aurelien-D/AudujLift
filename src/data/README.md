# Données embarquées

| Fichier | Contenu | Source | Licence |
|---|---|---|---|
| `ciqual.json` | ~3 400 aliments génériques | Table Ciqual 2025, ANSES (Zenodo) | CC-BY 4.0 |
| `off-fr.json` | 40 000 produits de marque les plus scannés en France | Open Food Facts (export Parquet) | ODbL 1.0 |
| `exercise-library.json`, `exercise-guides.json` | ~880 exercices, consignes traduites en français | Free Exercise DB (yuhonas) | Unlicense (domaine public) |
| `curated-refs.json` | Correspondance entre les exercices de base et Free Exercise DB | AudujLift | — |

Régénération : `scripts/ciqual2json.py`, `scripts/off-popular.py`, `scripts/exercises/build-library.py`.
