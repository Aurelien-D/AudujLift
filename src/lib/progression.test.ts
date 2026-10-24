import { describe, expect, it } from 'vitest'
import { estimateDurationMin, progressedWeight, roundLoad, warmupSets } from './progression'
import type { SetData } from './types'

const n = (weight: number | undefined, reps: number | undefined): SetData => ({ type: 'normal', weight, reps })

describe('progressedWeight', () => {
  const target = [n(undefined, 8), n(undefined, 8), n(undefined, 8)]

  it('ajoute 2,5 kg quand toutes les reps ont été faites', () => {
    expect(progressedWeight(target, [n(80, 8), n(80, 9), n(80, 8)])).toEqual({ from: 80, to: 82.5 })
  })

  it("ne progresse pas s'il manque des reps", () => {
    expect(progressedWeight(target, [n(80, 8), n(80, 7), n(80, 6)])).toBeUndefined()
  })

  it('ignore les séries à charges différentes, les charges imposées et l’absence d’historique', () => {
    expect(progressedWeight(target, [n(80, 8), n(75, 8), n(70, 8)])).toBeUndefined()
    expect(progressedWeight([n(60, 8)], [n(60, 8)])).toBeUndefined()
    expect(progressedWeight(target, undefined)).toBeUndefined()
    expect(progressedWeight(target, [n(80, 8), n(80, 8)])).toBeUndefined()
  })

  it("ne tient pas compte des séries d'échauffement", () => {
    const last: SetData[] = [{ type: 'warmup', weight: 40, reps: 5 }, n(80, 8), n(80, 8), n(80, 8)]
    expect(progressedWeight([{ type: 'warmup', reps: 5 }, ...target], last)).toEqual({ from: 80, to: 82.5 })
  })
})

describe('warmupSets', () => {
  it('barre, 50 %, 70 %, 85 %', () => {
    expect(warmupSets(100, 20, true).map((s) => s.weight)).toEqual([20, 50, 70, 85])
  })

  it('fusionne les paliers trop proches ou sous la barre', () => {
    expect(warmupSets(40, 20, true).map((s) => s.weight)).toEqual([20, 27.5, 35])
    expect(warmupSets(20, 20, true)).toEqual([])
  })

  it('sans barre (haltères, machines)', () => {
    expect(warmupSets(30, 20, false).map((s) => s.weight)).toEqual([15, 20, 25])
  })
})

describe('outils', () => {
  it('arrondit aux 2,5 kg', () => {
    expect(roundLoad(71.4)).toBe(72.5)
    expect(roundLoad(68.6)).toBe(67.5)
    expect(roundLoad(71.2)).toBe(70)
  })

  it('estime la durée par tranches de 5 min', () => {
    const ex = { restSec: 120, sets: [n(1, 1), n(1, 1), n(1, 1)] }
    // 3×40 + 2×120 + 60 = 420 s par exercice ; 4 exercices = 28 min → 30
    expect(estimateDurationMin([ex, ex, ex, ex])).toBe(30)
  })
})
