"""Construit la bibliothèque d'exercices d'AudujLift à partir de Free Exercise DB (domaine public).

Usage : python3 scripts/exercises/build-library.py <exercises.json de free-exercise-db> <dossier des traductions out*.json>

- src/data/exercise-library.json : exercices absents de la sélection de base (une ligne compacte par exercice)
- src/data/exercise-guides.json  : consignes en français, indexées par identifiant d'exercice de l'appli
Les traductions (noms + consignes) sont des fichiers {id: {name, instructions}} produits à partir des données anglaises.
"""
import glob
import json
import sys

src, tr_dir = sys.argv[1], sys.argv[2]
exercises = json.load(open(src, encoding='utf-8'))
fr = {}
for f in sorted(glob.glob(f'{tr_dir}/out*.json')):
    fr.update(json.load(open(f, encoding='utf-8')))
curated = json.load(open('src/data/curated-refs.json', encoding='utf-8'))  # id appli -> id FEDB
ref_to_app = {v: k for k, v in curated.items()}

MUSCLES = {
    'abdominals': 'abdos', 'abductors': 'fessiers', 'adductors': 'adducteurs', 'biceps': 'biceps', 'calves': 'mollets',
    'chest': 'pectoraux', 'forearms': 'avant-bras', 'glutes': 'fessiers', 'hamstrings': 'ischios', 'lats': 'dos',
    'lower back': 'lombaires', 'middle back': 'dos', 'neck': 'trapezes', 'quadriceps': 'quadriceps', 'shoulders': 'epaules',
    'traps': 'trapezes', 'triceps': 'triceps',
}
EQUIPMENT = {
    'barbell': 'barre', 'dumbbell': 'halteres', 'other': 'autre', 'body only': 'poids-du-corps', 'cable': 'poulie',
    'machine': 'machine', 'kettlebells': 'kettlebell', 'bands': 'elastique', 'medicine ball': 'medecine-ball',
    'exercise ball': 'swiss-ball', 'foam roll': 'autre', 'e-z curl bar': 'barre-ez',
}
CATEGORIES = {
    'strength': 'force', 'powerlifting': 'powerlifting', 'olympic weightlifting': 'halterophilie', 'strongman': 'strongman',
    'plyometrics': 'plyometrie', 'cardio': 'cardio', 'stretching': 'etirement',
}
LEVELS = {'beginner': 'debutant', 'intermediate': 'intermediaire', 'expert': 'expert'}

missing = [e['id'] for e in exercises if e['id'] not in fr]
if missing:
    sys.exit(f'Traductions manquantes : {len(missing)} (ex. {missing[:5]})')

rows, guides = [], {}
for e in exercises:
    t = fr[e['id']]
    app_id = ref_to_app.get(e['id'], f"fe-{e['id']}")
    steps = [x.strip() for x in t.get('instructions') or [] if x.strip().strip('.')]
    if steps:
        guides[app_id] = steps
    if e['id'] in ref_to_app:
        continue  # déjà dans la sélection de base (nom, standards de force…)
    category = CATEGORIES.get(e.get('category'), 'force')
    equipment = 'smith' if 'smith' in e['name'].lower() else EQUIPMENT.get(e.get('equipment') or '', None)
    if equipment is None:
        equipment = 'poids-du-corps' if category in ('etirement', 'plyometrie') else 'autre'
    muscles = [MUSCLES[m] for m in e['primaryMuscles'] if m in MUSCLES]
    secondary = [MUSCLES[m] for m in e['secondaryMuscles'] if m in MUSCLES]
    muscle = 'cardio' if category == 'cardio' else (muscles[0] if muscles else 'corps-entier')
    secondary = sorted({m for m in muscles[1:] + secondary if m != muscle})
    if category == 'cardio':
        kind = 'cardio'
    elif category == 'etirement' or (e.get('force') == 'static' and equipment == 'poids-du-corps'):
        kind = 'duration'
    elif equipment == 'poids-du-corps':
        kind = 'bodyweight'
    else:
        kind = 'weight_reps'
    rows.append([app_id, t['name'].strip(), muscle, secondary, equipment, kind, category, LEVELS.get(e.get('level'), 'intermediaire')])

rows.sort(key=lambda r: r[1].lower())
json.dump(rows, open('src/data/exercise-library.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(guides, open('src/data/exercise-guides.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(rows)} exercices ajoutés à la bibliothèque, {len(guides)} consignes')
