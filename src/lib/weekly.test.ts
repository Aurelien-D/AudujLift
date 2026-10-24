import { describe, expect, it } from 'vitest'
import type { Exercise, FoodEntry, Workout } from './types'
import { weekLabel, weekStart, weekSummary } from './weekly'

const bench: Exercise = { id: 'bench', name: 'Développé couché', muscle: 'pectoraux', secondary: ['triceps'], equipment: 'barre', kind: 'weight_reps' }
const exercises = new Map([[bench.id, bench]])
const monday = new Date(2026, 9, 19) // lundi 19 octobre 2026

const workout = (id: string, day: number, sets: number): Workout => ({
  id,
  name: 'Push',
  status: 'done',
  startedAt: new Date(2026, 9, day, 18).getTime(),
  endedAt: new Date(2026, 9, day, 19).getTime(),
  exercises: [{ uid: id, exerciseId: 'bench', restSec: 90, sets: Array.from({ length: sets }, () => ({ type: 'normal' as const, weight: 60, reps: 8, done: true })) }],
})
const entry = (date: string, kcal: number, protein: number): FoodEntry => ({
  id: date + kcal,
  date,
  meal: 'lunch',
  name: 'Repas',
  quantity: 100,
  unit: 'g',
  nutrients: { kcal, protein, carbs: 0, fat: 0 },
  createdAt: 0,
})
const settings = { weeklyWorkoutGoal: 3, goals: { kcal: 2500, protein: 150, carbs: 300, fat: 80, waterMl: 2500 } }

describe('bilan de la semaine', () => {
  it('agrège la semaine et compare à la précédente', () => {
    const s = weekSummary({
      start: monday,
      workouts: [workout('a', 20, 4), workout('b', 22, 4), workout('old', 14, 2)],
      exercises,
      entries: [entry('2026-10-20', 2400, 160), entry('2026-10-21', 2600, 140), entry('2026-10-12', 9999, 1)],
      bodyweights: [
        { id: '1', date: '2026-10-13', weight: 81 },
        { id: '2', date: '2026-10-20', weight: 80 },
        { id: '3', date: '2026-10-24', weight: 79.6 },
      ],
      settings,
    })
    expect(s.sessions).toBe(2)
    expect(s.volume).toBe(2 * 4 * 480)
    expect(s.prevVolume).toBe(2 * 480)
    expect(s.durationMs).toBe(2 * 3600000)
    expect(s.muscles.get('pectoraux')).toBe(8)
    expect(s.nutrition).toMatchObject({ days: 2, kcal: 2500, protein: 150 })
    expect(s.weight.avg).toBeCloseTo(79.8, 5)
    expect(s.weight.prevAvg).toBe(81)
    expect(s.tip).toMatch(/2 séances sur 3/)
  })

  it('propose de renforcer le muscle le plus en retard quand le reste est bon', () => {
    const s = weekSummary({
      start: monday,
      workouts: [workout('a', 20, 12), workout('b', 21, 2), workout('c', 23, 2)],
      exercises,
      entries: ['20', '21', '22', '23', '24'].map((d) => entry(`2026-10-${d}`, 2500, 160)),
      bodyweights: [],
      settings,
    })
    expect(s.tip).toMatch(/^(Dos|Épaules|Quadriceps|Ischios|Fessiers|Biceps) : 0 série/)
  })

  it('libellés de semaine', () => {
    expect(weekLabel(monday)).toBe('du 19 au 25 oct.')
    expect(weekStart(1, new Date(2026, 9, 24)).getDate()).toBe(12)
  })
})
