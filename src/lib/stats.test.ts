import { describe, expect, it } from 'vitest'
import {
  ageFactor,
  ageFromBirthYear,
  bodyRegion,
  computeRank,
  detectPRs,
  e1rm,
  e1rmForLevel,
  exerciseHistory,
  personalRecords,
  platesPerSide,
  rankFromLevel,
  rankFromScore,
  weeklyStreak,
} from './stats'
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
  const man80 = { sex: 'male' as const, bodyweight: 80, heightCm: 176 }
  it('le standard exact donne Émeraude IV (homme de référence)', () => {
    const r = computeRank(100, 1.25, man80)
    expect(r?.label).toBe('Émeraude IV')
    expect(r?.nextLabel).toBe('Émeraude III')
  })
  it('échelle Bronze → Challenger avec divisions', () => {
    expect(rankFromLevel(0.05).label).toBe('Bronze IV')
    expect(rankFromLevel(0.39).label).toBe('Bronze I')
    expect(rankFromLevel(0.39).nextLabel).toBe('Argent IV')
    expect(rankFromLevel(1.19).label).toBe('Émeraude I')
    expect(rankFromLevel(1.5).label).toBe('Maître')
    expect(rankFromLevel(1.5).nextLabel).toBe('Grand Maître')
    expect(rankFromLevel(2.4).label).toBe('Challenger')
    expect(rankFromLevel(2.4).nextLabel).toBeUndefined()
  })
  it('le palier suivant se calcule au bon niveau', () => {
    // Or : 0,6 → 0,8 ; Or IV jusqu'à 0,65
    const r = rankFromLevel(0.61)
    expect(r.label).toBe('Or IV')
    expect(r.nextLevel).toBeCloseTo(0.65)
    expect(e1rmForLevel(r.nextLevel!, 1.25, man80)).toBeCloseTo(65)
  })
  it('poids : non linéaire (DOTS), les lourds ne sont pas pénalisés par un simple ratio', () => {
    const needed = e1rmForLevel(1, 1.25, { sex: 'male', bodyweight: 120, heightCm: 176 })
    expect(needed).toBeGreaterThan(100)
    expect(needed).toBeLessThan(150) // l'ancien ratio linéaire demandait 150 kg
  })
  it('sexe : écart plus marqué en haut du corps', () => {
    const woman = { sex: 'female' as const, bodyweight: 60, heightCm: 163 }
    const upper = e1rmForLevel(1, 1.25, woman, 'upper')
    const lower = e1rmForLevel(1, 1.6, woman, 'lower')
    const man60 = { sex: 'male' as const, bodyweight: 60, heightCm: 176 }
    expect(upper / e1rmForLevel(1, 1.25, man60)).toBeLessThan(lower / e1rmForLevel(1, 1.6, man60, 'lower'))
    expect(upper / e1rmForLevel(1, 1.25, man60)).toBeGreaterThan(0.55)
  })
  it('taille : plus grand, objectif un peu plus bas, au plus 8 %', () => {
    const tall = e1rmForLevel(1, 1.25, { ...man80, heightCm: 195 })
    expect(tall).toBeLessThan(100)
    expect(e1rmForLevel(1, 1.25, { ...man80, heightCm: 230 })).toBeCloseTo(100 / 1.08)
    expect(e1rmForLevel(1, 1.25, { ...man80, heightCm: 0 })).toBeCloseTo(100)
  })
  it('bas du corps : le soulevé de terre compte comme jambes', () => {
    expect(bodyRegion({ muscle: 'dos', secondary: ['ischios', 'fessiers'] })).toBe('lower')
    expect(bodyRegion({ muscle: 'dos', secondary: ['biceps'] })).toBe('upper')
  })
  it('âge : coefficients Foster et McCulloch, neutres de 23 à 40 ans', () => {
    expect(ageFactor(30)).toBe(1)
    expect(ageFactor(40)).toBe(1)
    expect(ageFactor(18)).toBe(1.06)
    expect(ageFactor(10)).toBe(1.23)
    expect(ageFactor(50)).toBe(1.13)
    expect(ageFactor(60)).toBe(1.34)
    expect(ageFactor(95)).toBe(2.549)
    expect(ageFactor(undefined)).toBe(1)
    // À 60 ans, il faut 34 % de moins pour le même rang
    expect(e1rmForLevel(1, 1.25, { ...man80, age: 60 })).toBeCloseTo(100 / 1.34)
  })
  it("âge depuis l'année de naissance : le moins favorable", () => {
    const now = new Date(2026, 5, 1)
    expect(ageFromBirthYear(2008, now)).toBe(18) // jeune : âge le plus haut
    expect(ageFromBirthYear(1976, now)).toBe(49) // vétéran : âge le plus bas
    expect(ageFromBirthYear(0, now)).toBeUndefined()
  })
  it('rang global : moyenne des scores', () => {
    expect(rankFromScore(rankFromLevel(0.7).score).label).toBe('Or II')
  })
  it('renvoie undefined sans poids de corps', () => {
    expect(computeRank(100, 1.25, { sex: 'male', bodyweight: 0 })).toBeUndefined()
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
