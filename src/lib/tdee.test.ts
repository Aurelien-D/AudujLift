import { describe, expect, it } from 'vitest'
import { goalsForDay, rebalanceGoals } from './nutrition'
import { estimateTdee, slopePerDay } from './tdee'
import { addDays } from './utils'

const START = '2026-01-01'
const series = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => ({ date: addDays(START, i), value: f(i) }))

describe('estimateTdee', () => {
  it('poids stable : dépense = apport moyen', () => {
    const weights = series(21, () => 80).map((p) => ({ date: p.date, weight: p.value }))
    const intake = series(21, () => 2400).map((p) => ({ date: p.date, kcal: p.value }))
    expect(estimateTdee(weights, intake)?.tdee).toBe(2400)
  })

  it('perte de 0,5 kg/semaine : dépense ≈ apport + 550 kcal', () => {
    const weights = series(28, (i) => 80 - (0.5 / 7) * i).map((p) => ({ date: p.date, weight: p.value }))
    const intake = series(28, () => 2000).map((p) => ({ date: p.date, kcal: p.value }))
    const r = estimateTdee(weights, intake)!
    expect(r.kgPerWeek).toBeCloseTo(-0.5, 5)
    expect(r.tdee).toBe(2550)
  })

  it('écarte les journées incomplètes et exige assez de données', () => {
    const weights = series(21, () => 80).map((p) => ({ date: p.date, weight: p.value }))
    const intake = series(21, (i) => (i % 2 ? 300 : 2500)).map((p) => ({ date: p.date, kcal: p.value }))
    expect(estimateTdee(weights, intake)?.tdee).toBe(2500)
    expect(estimateTdee(weights.slice(0, 3), intake)).toBeUndefined()
    expect(estimateTdee(weights, intake.slice(0, 9))).toBeUndefined()
  })

  it('pente de régression', () => {
    expect(slopePerDay(series(5, (i) => 10 + 2 * i))).toBeCloseTo(2, 8)
  })
})

describe('objectifs du jour', () => {
  const settings = {
    goals: { kcal: 2600, protein: 160, carbs: 300, fat: 80, waterMl: 2500 },
    restGoals: { kcal: 2200, protein: 160, carbs: 200, fat: 80 },
    splitGoals: true,
  }
  it('entraînement vs repos', () => {
    expect(goalsForDay(settings, true).kcal).toBe(2600)
    expect(goalsForDay(settings, false).kcal).toBe(2200)
    expect(goalsForDay({ ...settings, splitGoals: false }, false).kcal).toBe(2600)
  })
  it('rééquilibre les glucides', () => {
    expect(rebalanceGoals({ kcal: 2600, protein: 160, carbs: 300, fat: 80 }, 2400)).toEqual({ kcal: 2400, protein: 160, fat: 80, carbs: 260 })
  })
})
