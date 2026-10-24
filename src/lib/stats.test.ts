import { describe, expect, it } from 'vitest'
import { computeRank, detectPRs, e1rm, exerciseHistory, personalRecords, platesPerSide, weeklyStreak } from './stats'
import type { Exercise, Workout } from './types'

const bench: Exercise = { id: 'bench-press', name: 'Développé couché', muscle: 'pectoraux', secondary: [], equipment: 'barre', kind: 'weight_reps', standard: 1.25 }

function workout(id: string, day: number, sets: [number, number][]): Workout {
  return {
    id,
    name: 'Push',
    status: 'done',
    startedAt: new Date(2026, 0, day, 18).getTime(),
    endedAt: new Date(2026, 0, day, 19).getTime(),
    exercises: [{ uid: id, exerciseId: 'bench-press', restSec: 120, sets: sets.map(([weight, reps]) => ({ type: 'normal', weight, reps, done: true })) }],
  }
}

describe('e1rm', () => {
  it('suit la formule d’Epley', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1)
    expect(e1rm(0, 5)).toBe(0)
  })
})

describe('historique et records', () => {
  const ws = [
    workout('a', 5, [
      [80, 8],
      [80, 7],
    ]),
    workout('b', 12, [
      [85, 6],
      [80, 8],
    ]),
  ]
  it('trie du plus récent au plus ancien', () => {
    const h = exerciseHistory(bench, ws)
    expect(h.map((s) => s.workoutId)).toEqual(['b', 'a'])
    expect(h[0].maxWeight).toBe(85)
  })
  it('calcule les records', () => {
    const pr = personalRecords(exerciseHistory(bench, ws))
    expect(pr.maxWeight).toMatchObject({ value: 85, reps: 6 })
    expect(pr.repMaxes[8].weight).toBe(80)
    expect(pr.bestE1rm!.value).toBeCloseTo(102, 0)
  })
  it('détecte un nouveau record mais pas lors de la première séance', () => {
    const map = new Map([[bench.id, bench]])
    expect(detectPRs(ws[0], [], map)).toEqual([])
    const labels = detectPRs(ws[1], ws, map).map((p) => p.label)
    expect(labels).toContain('1RM estimé')
    expect(labels).toContain('Charge max')
    const max = detectPRs(ws[1], ws, map).find((p) => p.label === 'Charge max')
    expect(max?.previous).toMatch(/kg$/)
  })
})

describe('rangs', () => {
  it('attribue Platine au standard exact', () => {
    expect(computeRank(100, 80, 1.25, 'male')?.rank.name).toBe('Platine')
  })
  it('ajuste pour les femmes', () => {
    expect(computeRank(62, 80, 1.25, 'female')?.rank.name).toBe('Platine')
  })
  it('renvoie undefined sans poids de corps', () => {
    expect(computeRank(100, 0, 1.25, 'male')).toBeUndefined()
  })
})

describe('régularité', () => {
  it('compte les semaines consécutives atteignant l’objectif', () => {
    const now = new Date(2026, 9, 22) // jeudi
    const d = (m: number, day: number) => new Date(2026, m, day, 12).getTime()
    // semaine en cours : 2 séances ; 2 semaines précédentes : 2 séances ; avant : 1
    const dates = [d(9, 19), d(9, 21), d(9, 13), d(9, 15), d(9, 6), d(9, 8), d(8, 29)]
    expect(weeklyStreak(dates, 2, now)).toBe(3)
    expect(weeklyStreak(dates, 3, now)).toBe(0)
  })
})

describe('disques', () => {
  it('répartit la charge de chaque côté', () => {
    expect(platesPerSide(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25])).toEqual({ plates: [25, 15], remainder: 0 })
    expect(platesPerSide(61, 20, [20, 10, 5, 2.5, 1.25]).remainder).toBeCloseTo(1, 5)
  })
})
