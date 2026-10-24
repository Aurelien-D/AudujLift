import curatedRefs from '../data/curated-refs.json'
import type { Equipment, Exercise, ExerciseCategory, ExerciseKind, MuscleGroup } from './types'

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos',
  epaules: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  'avant-bras': 'Avant-bras',
  abdos: 'Abdos',
  quadriceps: 'Quadriceps',
  ischios: 'Ischios',
  fessiers: 'Fessiers',
  mollets: 'Mollets',
  trapezes: 'Trapèzes',
  lombaires: 'Lombaires',
  adducteurs: 'Adducteurs',
  cardio: 'Cardio',
  'corps-entier': 'Corps entier',
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barre: 'Barre',
  halteres: 'Haltères',
  machine: 'Machine',
  poulie: 'Poulie',
  'poids-du-corps': 'Poids du corps',
  kettlebell: 'Kettlebell',
  'barre-ez': 'Barre EZ',
  smith: 'Smith machine',
  elastique: 'Élastique',
  'medecine-ball': 'Médecine-ball',
  'swiss-ball': 'Swiss ball',
  autre: 'Autre',
}

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  force: 'Musculation',
  powerlifting: 'Powerlifting',
  halterophilie: 'Haltérophilie',
  strongman: 'Strongman',
  plyometrie: 'Pliométrie',
  cardio: 'Cardio',
  etirement: 'Étirement / mobilité',
}

export const LEVEL_LABELS = { debutant: 'Débutant', intermediaire: 'Intermédiaire', expert: 'Expert' } as const

/** Photos (position de départ / d'arrivée) de Free Exercise DB, domaine public */
export const EXERCISE_IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises'
export const exerciseImages = (e: Pick<Exercise, 'ref'>) => (e.ref ? [`${EXERCISE_IMAGE_BASE}/${e.ref}/0.jpg`, `${EXERCISE_IMAGE_BASE}/${e.ref}/1.jpg`] : [])

/** Bibliothèque complète (~770 exercices) : [id, nom, muscle, secondaires, équipement, mesure, catégorie, niveau] */
export type LibraryRow = [string, string, MuscleGroup, MuscleGroup[], Equipment, ExerciseKind, ExerciseCategory, Exercise['level']]

export const libraryRowToExercise = ([id, name, muscle, secondary, equipment, kind, category, level]: LibraryRow): Exercise => ({
  id,
  name,
  muscle,
  secondary,
  equipment,
  kind,
  category,
  level,
  ref: id.slice(3),
})

export const KIND_LABELS: Record<ExerciseKind, string> = {
  weight_reps: 'Poids × répétitions',
  bodyweight: 'Poids du corps (+ lest)',
  duration: 'Durée',
  cardio: 'Distance + durée',
}

type Row = [id: string, name: string, muscle: MuscleGroup, secondary: MuscleGroup[], equipment: Equipment, kind?: ExerciseKind, standard?: number]

// standard = ratio e1RM / poids de corps visé pour le rang « Platine » (homme).
const ROWS: Row[] = [
  // Pectoraux
  ['bench-press', 'Développé couché (barre)', 'pectoraux', ['triceps', 'epaules'], 'barre', 'weight_reps', 1.25],
  ['incline-bench-press', 'Développé incliné (barre)', 'pectoraux', ['epaules', 'triceps'], 'barre', 'weight_reps', 1.05],
  ['decline-bench-press', 'Développé décliné (barre)', 'pectoraux', ['triceps'], 'barre', 'weight_reps', 1.25],
  ['db-bench-press', 'Développé couché (haltères)', 'pectoraux', ['triceps', 'epaules'], 'halteres', 'weight_reps', 0.45],
  ['db-incline-press', 'Développé incliné (haltères)', 'pectoraux', ['epaules', 'triceps'], 'halteres', 'weight_reps', 0.4],
  ['smith-incline-press', 'Développé incliné (Smith)', 'pectoraux', ['epaules', 'triceps'], 'smith', 'weight_reps', 1.0],
  ['machine-chest-press', 'Chest press (machine)', 'pectoraux', ['triceps'], 'machine', 'weight_reps', 1.1],
  ['db-fly', 'Écarté couché (haltères)', 'pectoraux', [], 'halteres', 'weight_reps', 0.25],
  ['pec-deck', 'Pec deck / Butterfly', 'pectoraux', [], 'machine', 'weight_reps', 0.9],
  ['cable-crossover', 'Écarté à la poulie (vis-à-vis)', 'pectoraux', [], 'poulie', 'weight_reps', 0.35],
  ['push-up', 'Pompes', 'pectoraux', ['triceps', 'epaules'], 'poids-du-corps', 'bodyweight'],
  ['chest-dips', 'Dips (pectoraux)', 'pectoraux', ['triceps', 'epaules'], 'poids-du-corps', 'bodyweight', 1.5],
  ['pullover', 'Pull-over (haltère)', 'pectoraux', ['dos'], 'halteres', 'weight_reps', 0.4],

  // Dos
  ['deadlift', 'Soulevé de terre', 'dos', ['ischios', 'fessiers', 'lombaires', 'trapezes'], 'barre', 'weight_reps', 2.0],
  ['pull-up', 'Tractions', 'dos', ['biceps'], 'poids-du-corps', 'bodyweight', 1.4],
  ['chin-up', 'Tractions supination', 'dos', ['biceps'], 'poids-du-corps', 'bodyweight', 1.45],
  ['lat-pulldown', 'Tirage vertical (poulie)', 'dos', ['biceps'], 'poulie', 'weight_reps', 1.0],
  ['close-grip-pulldown', 'Tirage vertical prise serrée', 'dos', ['biceps'], 'poulie', 'weight_reps', 1.0],
  ['barbell-row', 'Rowing barre', 'dos', ['biceps', 'lombaires'], 'barre', 'weight_reps', 1.1],
  ['pendlay-row', 'Rowing Pendlay', 'dos', ['biceps', 'lombaires'], 'barre', 'weight_reps', 1.0],
  ['db-row', 'Rowing haltère unilatéral', 'dos', ['biceps'], 'halteres', 'weight_reps', 0.55],
  ['seated-cable-row', 'Tirage horizontal (poulie)', 'dos', ['biceps'], 'poulie', 'weight_reps', 1.0],
  ['t-bar-row', 'Rowing T-bar', 'dos', ['biceps'], 'barre', 'weight_reps', 1.0],
  ['machine-row', 'Rowing machine', 'dos', ['biceps'], 'machine', 'weight_reps', 1.0],
  ['straight-arm-pulldown', 'Pull-down bras tendus', 'dos', [], 'poulie', 'weight_reps', 0.45],
  ['rack-pull', 'Rack pull', 'dos', ['trapezes', 'lombaires'], 'barre', 'weight_reps', 2.2],
  ['inverted-row', 'Rowing inversé', 'dos', ['biceps'], 'poids-du-corps', 'bodyweight'],

  // Épaules
  ['overhead-press', 'Développé militaire (barre)', 'epaules', ['triceps'], 'barre', 'weight_reps', 0.8],
  ['db-shoulder-press', 'Développé épaules (haltères)', 'epaules', ['triceps'], 'halteres', 'weight_reps', 0.35],
  ['arnold-press', 'Développé Arnold', 'epaules', ['triceps'], 'halteres', 'weight_reps', 0.3],
  ['machine-shoulder-press', 'Développé épaules (machine)', 'epaules', ['triceps'], 'machine', 'weight_reps', 0.8],
  ['lateral-raise', 'Élévations latérales (haltères)', 'epaules', [], 'halteres', 'weight_reps', 0.18],
  ['cable-lateral-raise', 'Élévations latérales (poulie)', 'epaules', [], 'poulie', 'weight_reps', 0.12],
  ['machine-lateral-raise', 'Élévations latérales (machine)', 'epaules', [], 'machine', 'weight_reps', 0.4],
  ['front-raise', 'Élévations frontales', 'epaules', [], 'halteres', 'weight_reps', 0.18],
  ['rear-delt-fly', 'Oiseau (haltères)', 'epaules', ['dos'], 'halteres', 'weight_reps', 0.15],
  ['reverse-pec-deck', 'Reverse pec deck', 'epaules', ['dos'], 'machine', 'weight_reps', 0.6],
  ['face-pull', 'Face pull', 'epaules', ['trapezes'], 'poulie', 'weight_reps', 0.4],
  ['upright-row', 'Tirage menton', 'epaules', ['trapezes'], 'barre', 'weight_reps', 0.55],

  // Trapèzes
  ['barbell-shrug', 'Shrug (barre)', 'trapezes', [], 'barre', 'weight_reps', 1.5],
  ['db-shrug', 'Shrug (haltères)', 'trapezes', [], 'halteres', 'weight_reps', 0.6],

  // Biceps
  ['barbell-curl', 'Curl barre', 'biceps', ['avant-bras'], 'barre', 'weight_reps', 0.6],
  ['ez-curl', 'Curl barre EZ', 'biceps', ['avant-bras'], 'barre-ez', 'weight_reps', 0.6],
  ['db-curl', 'Curl haltères', 'biceps', ['avant-bras'], 'halteres', 'weight_reps', 0.25],
  ['hammer-curl', 'Curl marteau', 'biceps', ['avant-bras'], 'halteres', 'weight_reps', 0.27],
  ['incline-db-curl', 'Curl incliné (haltères)', 'biceps', [], 'halteres', 'weight_reps', 0.2],
  ['preacher-curl', 'Curl pupitre', 'biceps', [], 'barre-ez', 'weight_reps', 0.5],
  ['cable-curl', 'Curl à la poulie', 'biceps', [], 'poulie', 'weight_reps', 0.5],
  ['concentration-curl', 'Curl concentré', 'biceps', [], 'halteres', 'weight_reps', 0.2],
  ['spider-curl', 'Spider curl', 'biceps', [], 'halteres', 'weight_reps', 0.18],

  // Triceps
  ['close-grip-bench', 'Développé couché prise serrée', 'triceps', ['pectoraux'], 'barre', 'weight_reps', 1.05],
  ['skull-crusher', 'Barre au front', 'triceps', [], 'barre-ez', 'weight_reps', 0.5],
  ['triceps-pushdown', 'Extension triceps poulie (barre)', 'triceps', [], 'poulie', 'weight_reps', 0.5],
  ['rope-pushdown', 'Extension triceps poulie (corde)', 'triceps', [], 'poulie', 'weight_reps', 0.4],
  ['overhead-triceps-ext', 'Extension triceps au-dessus de la tête (poulie)', 'triceps', [], 'poulie', 'weight_reps', 0.4],
  ['db-overhead-ext', 'Extension triceps nuque (haltère)', 'triceps', [], 'halteres', 'weight_reps', 0.35],
  ['triceps-dips', 'Dips (triceps)', 'triceps', ['pectoraux'], 'poids-du-corps', 'bodyweight', 1.5],
  ['bench-dips', 'Dips sur banc', 'triceps', [], 'poids-du-corps', 'bodyweight'],
  ['kickback', 'Kickback (haltère)', 'triceps', [], 'halteres', 'weight_reps', 0.15],

  // Avant-bras
  ['wrist-curl', 'Curl poignets', 'avant-bras', [], 'barre', 'weight_reps', 0.5],
  ['reverse-curl', 'Curl inversé', 'avant-bras', ['biceps'], 'barre-ez', 'weight_reps', 0.45],
  ['farmer-walk', 'Marche du fermier', 'avant-bras', ['trapezes', 'corps-entier'], 'halteres', 'duration'],

  // Jambes — quadriceps
  ['back-squat', 'Squat (barre)', 'quadriceps', ['fessiers', 'ischios', 'lombaires'], 'barre', 'weight_reps', 1.6],
  ['front-squat', 'Front squat', 'quadriceps', ['fessiers', 'abdos'], 'barre', 'weight_reps', 1.3],
  ['hack-squat', 'Hack squat', 'quadriceps', ['fessiers'], 'machine', 'weight_reps', 2.0],
  ['smith-squat', 'Squat (Smith)', 'quadriceps', ['fessiers'], 'smith', 'weight_reps', 1.5],
  ['leg-press', 'Presse à cuisses', 'quadriceps', ['fessiers', 'ischios'], 'machine', 'weight_reps', 3.0],
  ['leg-extension', 'Leg extension', 'quadriceps', [], 'machine', 'weight_reps', 1.0],
  ['goblet-squat', 'Goblet squat', 'quadriceps', ['fessiers'], 'halteres', 'weight_reps', 0.6],
  ['bulgarian-split-squat', 'Squat bulgare', 'quadriceps', ['fessiers'], 'halteres', 'weight_reps', 0.5],
  ['lunges', 'Fentes (haltères)', 'quadriceps', ['fessiers'], 'halteres', 'weight_reps', 0.45],
  ['walking-lunges', 'Fentes marchées', 'quadriceps', ['fessiers'], 'halteres', 'weight_reps', 0.45],
  ['step-up', 'Step-up', 'quadriceps', ['fessiers'], 'halteres', 'weight_reps', 0.4],
  ['sissy-squat', 'Sissy squat', 'quadriceps', [], 'poids-du-corps', 'bodyweight'],

  // Ischios / fessiers
  ['romanian-deadlift', 'Soulevé de terre roumain', 'ischios', ['fessiers', 'lombaires'], 'barre', 'weight_reps', 1.5],
  ['db-rdl', 'Soulevé de terre roumain (haltères)', 'ischios', ['fessiers'], 'halteres', 'weight_reps', 0.6],
  ['stiff-leg-deadlift', 'Soulevé de terre jambes tendues', 'ischios', ['lombaires'], 'barre', 'weight_reps', 1.4],
  ['lying-leg-curl', 'Leg curl allongé', 'ischios', [], 'machine', 'weight_reps', 0.8],
  ['seated-leg-curl', 'Leg curl assis', 'ischios', [], 'machine', 'weight_reps', 0.9],
  ['nordic-curl', 'Nordic curl', 'ischios', [], 'poids-du-corps', 'bodyweight'],
  ['good-morning', 'Good morning', 'ischios', ['lombaires'], 'barre', 'weight_reps', 0.9],
  ['hip-thrust', 'Hip thrust (barre)', 'fessiers', ['ischios'], 'barre', 'weight_reps', 2.0],
  ['machine-hip-thrust', 'Hip thrust (machine)', 'fessiers', ['ischios'], 'machine', 'weight_reps', 2.0],
  ['glute-bridge', 'Pont fessier', 'fessiers', ['ischios'], 'barre', 'weight_reps', 1.6],
  ['cable-kickback', 'Kickback fessier (poulie)', 'fessiers', [], 'poulie', 'weight_reps', 0.3],
  ['hip-abduction', 'Abduction hanche (machine)', 'fessiers', [], 'machine', 'weight_reps', 1.0],
  ['hip-adduction', 'Adduction hanche (machine)', 'adducteurs', [], 'machine', 'weight_reps', 1.0],
  ['sumo-deadlift', 'Soulevé de terre sumo', 'fessiers', ['quadriceps', 'ischios', 'dos', 'adducteurs'], 'barre', 'weight_reps', 2.0],
  ['kb-swing', 'Swing kettlebell', 'fessiers', ['ischios', 'lombaires'], 'kettlebell', 'weight_reps', 0.5],

  // Mollets
  ['standing-calf-raise', 'Mollets debout (machine)', 'mollets', [], 'machine', 'weight_reps', 1.5],
  ['seated-calf-raise', 'Mollets assis', 'mollets', [], 'machine', 'weight_reps', 1.0],
  ['leg-press-calf', 'Mollets à la presse', 'mollets', [], 'machine', 'weight_reps', 2.0],

  // Lombaires
  ['back-extension', 'Extensions lombaires', 'lombaires', ['fessiers', 'ischios'], 'poids-du-corps', 'bodyweight'],

  // Abdos
  ['crunch', 'Crunch', 'abdos', [], 'poids-du-corps', 'bodyweight'],
  ['cable-crunch', 'Crunch à la poulie', 'abdos', [], 'poulie', 'weight_reps', 0.8],
  ['hanging-leg-raise', 'Relevés de jambes suspendu', 'abdos', [], 'poids-du-corps', 'bodyweight'],
  ['leg-raise', 'Relevés de jambes au sol', 'abdos', [], 'poids-du-corps', 'bodyweight'],
  ['plank', 'Gainage (planche)', 'abdos', ['lombaires'], 'poids-du-corps', 'duration'],
  ['side-plank', 'Gainage latéral', 'abdos', [], 'poids-du-corps', 'duration'],
  ['ab-wheel', 'Roue abdominale', 'abdos', [], 'autre', 'bodyweight'],
  ['russian-twist', 'Russian twist', 'abdos', [], 'poids-du-corps', 'bodyweight'],
  ['dead-bug', 'Dead bug', 'abdos', [], 'poids-du-corps', 'bodyweight'],

  // Corps entier
  ['power-clean', 'Épaulé (power clean)', 'corps-entier', ['quadriceps', 'dos', 'trapezes'], 'barre', 'weight_reps', 1.2],
  ['thruster', 'Thruster', 'corps-entier', ['quadriceps', 'epaules'], 'barre', 'weight_reps', 0.9],
  ['burpee', 'Burpees', 'corps-entier', ['cardio'], 'poids-du-corps', 'bodyweight'],

  // Cardio
  ['treadmill', 'Tapis de course', 'cardio', [], 'machine', 'cardio'],
  ['running', 'Course à pied', 'cardio', [], 'autre', 'cardio'],
  ['bike', 'Vélo', 'cardio', [], 'machine', 'cardio'],
  ['rowing-machine', 'Rameur', 'cardio', ['dos'], 'machine', 'cardio'],
  ['elliptical', 'Vélo elliptique', 'cardio', [], 'machine', 'cardio'],
  ['stairmaster', 'Escalier (stairmaster)', 'cardio', ['fessiers'], 'machine', 'cardio'],
  ['jump-rope', 'Corde à sauter', 'cardio', ['mollets'], 'autre', 'duration'],
]

const REFS = curatedRefs as Record<string, string>

export const DEFAULT_EXERCISES: Exercise[] = ROWS.map(([id, name, muscle, secondary, equipment, kind = 'weight_reps', standard]) => ({
  id,
  name,
  muscle,
  secondary,
  equipment,
  kind,
  core: true,
  category: kind === 'cardio' ? 'cardio' : 'force',
  ...(standard ? { standard } : {}),
  ...(REFS[id] ? { ref: REFS[id] } : {}),
}))
