import { describe, expect, it } from 'vitest'
import { filterExercises } from './exercise-search'
import { DEFAULT_EXERCISES, libraryRowToExercise } from './exercises-data'
import type { Exercise } from './types'

const library: Exercise[] = [
  ...DEFAULT_EXERCISES,
  libraryRowToExercise(['fe-Barbell_Squat_To_A_Bench', 'Squat sur banc (barre)', 'quadriceps', ['fessiers'], 'barre', 'weight_reps', 'force', 'intermediaire']),
  libraryRowToExercise(['fe-Zercher_Squats', 'Squat Zercher (barre)', 'quadriceps', [], 'barre', 'weight_reps', 'force', 'expert']),
]

describe('recherche d’exercices', () => {
  it('met les exercices de base en tête', () => {
    const r = filterExercises(library, 'squat', 'all')
    expect(r[0].core).toBe(true)
    expect(r.map((e) => e.id)).toContain('fe-Zercher_Squats')
  })
  it('accepte plusieurs mots dans le désordre et sans accents', () => {
    expect(filterExercises(library, 'couche developpe halteres', 'all')[0].id).toBe('db-bench-press')
  })
  it('filtre par muscle et par matériel', () => {
    const r = filterExercises(library, '', 'quadriceps', 'barre')
    expect(r.length).toBeGreaterThan(2)
    expect(r.every((e) => e.equipment === 'barre')).toBe(true)
  })
  it('associe les photos aux exercices de la bibliothèque', () => {
    expect(library.find((e) => e.id === 'fe-Zercher_Squats')?.ref).toBe('Zercher_Squats')
    expect(DEFAULT_EXERCISES.find((e) => e.id === 'bench-press')?.ref).toBe('Barbell_Bench_Press_-_Medium_Grip')
  })
})
