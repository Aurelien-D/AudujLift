import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_EXERCISES, libraryRowToExercise, type LibraryRow } from './exercises-data'
import { activeProfileId, dbNameFor } from './profiles'
import type { BodyWeight, DayLog, Exercise, Food, FoodEntry, Routine, Settings, Workout } from './types'

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  sex: 'male',
  birthYear: 1995,
  heightCm: 178,
  activity: 'moderate',
  goal: 'maintain',
  goals: { kcal: 2500, protein: 150, carbs: 290, fat: 80, waterMl: 2500 },
  defaultRestSec: 120,
  weeklyWorkoutGoal: 3,
  barWeight: 20,
  availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25],
  onboarded: false,
}

interface SettingsRow {
  key: 'settings'
  value: Settings
}

export class AudujLiftDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  foods!: EntityTable<Food, 'id'>
  entries!: EntityTable<FoodEntry, 'id'>
  days!: EntityTable<DayLog, 'date'>
  bodyweights!: EntityTable<BodyWeight, 'id'>
  settings!: EntityTable<SettingsRow, 'key'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      exercises: 'id, name, muscle, equipment, custom',
      routines: 'id, name, folder, updatedAt, lastUsedAt',
      workouts: 'id, status, startedAt, routineId',
      foods: 'id, barcode, name, source, favorite, lastUsedAt',
      entries: 'id, date, meal, foodId, createdAt',
      days: 'date',
      bodyweights: 'id, date',
      settings: 'key',
    })
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(DEFAULT_EXERCISES)
    })
  }
}

/** Base du profil actif */
export const db = new AudujLiftDB(dbNameFor(activeProfileId()))

/** Version de la bibliothèque d'exercices : l'incrémenter pour pousser de nouveaux exercices. */
const LIBRARY_VERSION = '2'

/**
 * Ajoute les exercices de la bibliothèque absents de la base du profil, et complète les exercices
 * de base déjà présents (photos, catégorie) sans écraser ce que l'utilisateur a modifié.
 */
export async function syncDefaultExercises() {
  const key = `audujlift.exerciseLibrary.${db.name}`
  if (localStorage.getItem(key) === LIBRARY_VERSION) return
  const { default: rows } = await import('../data/exercise-library.json')
  const library = [...DEFAULT_EXERCISES, ...(rows as LibraryRow[]).map(libraryRowToExercise)]
  await db.transaction('rw', db.exercises, async () => {
    const existing = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
    await db.exercises.bulkAdd(library.filter((e) => !existing.has(e.id)))
    for (const e of DEFAULT_EXERCISES) {
      const cur = existing.get(e.id)
      if (cur && !cur.custom && !cur.ref) await db.exercises.update(e.id, { core: true, category: e.category, ref: e.ref })
    }
  })
  localStorage.setItem(key, LIBRARY_VERSION)
}

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings')
  return { ...DEFAULT_SETTINGS, ...row?.value, goals: { ...DEFAULT_SETTINGS.goals, ...row?.value?.goals } }
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings()
  await db.settings.put({ key: 'settings', value: { ...current, ...patch } })
}
