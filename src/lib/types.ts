// ---------- Entraînement ----------

export type MuscleGroup =
  | 'pectoraux'
  | 'dos'
  | 'epaules'
  | 'biceps'
  | 'triceps'
  | 'avant-bras'
  | 'abdos'
  | 'quadriceps'
  | 'ischios'
  | 'fessiers'
  | 'mollets'
  | 'trapezes'
  | 'lombaires'
  | 'adducteurs'
  | 'cardio'
  | 'corps-entier'

export type Equipment =
  'barre' | 'halteres' | 'machine' | 'poulie' | 'poids-du-corps' | 'kettlebell' | 'barre-ez' | 'smith' | 'elastique' | 'medecine-ball' | 'swiss-ball' | 'autre'

export type ExerciseCategory = 'force' | 'powerlifting' | 'halterophilie' | 'strongman' | 'plyometrie' | 'cardio' | 'etirement'

/** Comment une série est mesurée */
export type ExerciseKind = 'weight_reps' | 'bodyweight' | 'duration' | 'cardio'

export interface Exercise {
  id: string
  name: string
  muscle: MuscleGroup
  secondary: MuscleGroup[]
  equipment: Equipment
  kind: ExerciseKind
  /** Ratio e1RM / poids de corps correspondant au rang « Platine » (homme). Absent = pas de rang. */
  standard?: number
  custom?: boolean
  notes?: string
  /** Exercice de la sélection de base (mis en avant dans les listes) */
  core?: boolean
  category?: ExerciseCategory
  level?: 'debutant' | 'intermediaire' | 'expert'
  /** Identifiant dans Free Exercise DB (photos et consignes) */
  ref?: string
}

export type SetType = 'warmup' | 'normal' | 'drop' | 'failure'

export interface SetData {
  type: SetType
  weight?: number // kg (lest pour exercices au poids du corps)
  reps?: number
  duration?: number // secondes
  distance?: number // km
  rpe?: number
}

export interface WorkoutSet extends SetData {
  done: boolean
  completedAt?: number
}

export interface RoutineExercise {
  uid: string
  exerciseId: string
  sets: SetData[]
  restSec: number
  notes?: string
  supersetId?: string
}

export interface Routine {
  id: string
  name: string
  folder?: string
  exercises: RoutineExercise[]
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
}

export interface WorkoutExercise {
  uid: string
  exerciseId: string
  sets: WorkoutSet[]
  restSec: number
  notes?: string
  supersetId?: string
  /** Charge augmentée automatiquement (toutes les reps réussies la dernière fois) */
  progression?: { from: number; to: number }
}

export interface Workout {
  id: string
  name: string
  routineId?: string
  status: 'active' | 'done'
  startedAt: number
  endedAt?: number
  exercises: WorkoutExercise[]
  notes?: string
  /** Poids de corps au moment de la séance (pour les rangs) */
  bodyweight?: number
}

// ---------- Nutrition ----------

export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
  sugar?: number
  fiber?: number
  saturatedFat?: number
  salt?: number
}

export interface Food {
  id: string
  source: 'off' | 'custom' | 'ciqual'
  barcode?: string
  name: string
  brand?: string
  imageUrl?: string
  /** Photos prises par l'utilisateur (data URL JPEG compressées) */
  photos?: string[]
  /** Valeurs pour 100 g / 100 ml */
  per100: Nutrients
  unit: 'g' | 'ml'
  servingSize?: number
  servingLabel?: string
  nutriscore?: string
  favorite?: boolean
  lastUsedAt?: number
  /** Dernière quantité consommée (proposée par défaut la fois suivante) */
  lastQuantity?: number
  createdAt: number
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface FoodEntry {
  id: string
  date: string // YYYY-MM-DD
  meal: Meal
  foodId?: string
  name: string
  brand?: string
  quantity: number // g ou ml ; 0 pour un ajout rapide
  unit: 'g' | 'ml'
  nutrients: Nutrients // pour la quantité consommée
  createdAt: number
}

export interface DayLog {
  date: string
  waterMl: number
  /** Type de journée choisi à la main (sinon : entraînement si une séance a eu lieu) */
  dayType?: 'training' | 'rest'
}

/** Repas favori / recette : un ensemble d'aliments à ajouter en un geste */
export interface SavedMeal {
  id: string
  name: string
  items: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'createdAt'>[]
  createdAt: number
  lastUsedAt?: number
}

/** Mensurations (cm), toutes optionnelles */
export interface Measurement {
  id: string
  date: string
  waist?: number
  chest?: number
  hips?: number
  arm?: number
  thigh?: number
  calf?: number
  neck?: number
  shoulders?: number
  bodyFat?: number
}

export interface ProgressPhoto {
  id: string
  date: string
  pose: 'front' | 'side' | 'back'
  /** JPEG compressé (data URL) */
  dataUrl: string
  createdAt: number
}

export interface BodyWeight {
  id: string
  date: string
  weight: number
}

// ---------- Profil / réglages ----------

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Goal = 'cut' | 'maintain' | 'bulk'

export interface Settings {
  name: string
  sex: Sex
  birthYear: number
  heightCm: number
  activity: Activity
  goal: Goal
  goals: { kcal: number; protein: number; carbs: number; fat: number; waterMl: number }
  defaultRestSec: number
  weeklyWorkoutGoal: number
  barWeight: number
  availablePlates: number[]
  onboarded: boolean
  /** Garder l'écran allumé pendant une séance */
  keepAwake: boolean
  /** Proposer de noter l'effort (RPE) après chaque série */
  askRpe: boolean
  /** Surcharge progressive automatique (+2,5 kg) */
  autoProgression: boolean
  /** Objectifs distincts les jours de repos (les objectifs principaux valent pour les jours d'entraînement) */
  splitGoals: boolean
  restGoals: { kcal: number; protein: number; carbs: number; fat: number }
  /** Dernier export de sauvegarde (timestamp) */
  lastBackupAt?: number
  /** Suggestion d'ajustement des calories masquée jusqu'à… */
  tdeeSnoozeUntil?: number
}
