import { describe, expect, it } from 'vitest'
import { rankChanges, rankSnapshot, standardFor } from './rank-standards'
import type { Exercise, Workout } from './types'

const ex = (o: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise => ({ name: o.id, muscle: 'pectoraux', secondary: [], equipment: 'barre', kind: 'weight_reps', ...o })
const body = { sex: 'male' as const, bodyweight: 80, heightCm: 176 }
const workout = (id: string, startedAt: number, sets: [string, number, number][]): Workout => ({
  id,
  name: id,
  status: 'done',
  startedAt,
  endedAt: startedAt + 3600_000,
  bodyweight: 80,
  exercises: sets.map(([exerciseId, weight, reps], i) => ({ uid: `${id}${i}`, exerciseId, restSec: 90, sets: [{ type: 'normal', weight, reps, done: true }] })),
})

describe('barèmes des rangs', () => {
  it('exercice de base : barème de la base, même si la valeur enregistrée est ancienne', () => {
    expect(standardFor(ex({ id: 'bench-press', standard: 9 }))).toEqual({ value: 1.25, estimated: false })
  })
  it('variante créée : barème hérité', () => {
    expect(standardFor(ex({ id: 'perso', standard: 0.7, custom: true }))).toEqual({ value: 0.7, estimated: false })
  })
  it('bibliothèque : estimé, et plus bas pour un mono-articulaire', () => {
    const press = standardFor(ex({ id: 'fe-x', equipment: 'halteres', secondary: ['triceps'], category: 'force' }))
    const fly = standardFor(ex({ id: 'fe-y', equipment: 'halteres', secondary: [], category: 'force' }))
    expect(press?.estimated).toBe(true)
    expect(fly!.value).toBeLessThan(press!.value)
  })
  it('kettlebell estimé comme un haltère, Smith comme une barre', () => {
    expect(standardFor(ex({ id: 'fe-k', equipment: 'kettlebell', secondary: ['triceps'] }))?.value).toBe(
      standardFor(ex({ id: 'fe-h', equipment: 'halteres', secondary: ['triceps'] }))?.value,
    )
    expect(standardFor(ex({ id: 'fe-s', equipment: 'smith', secondary: ['triceps'] }))?.estimated).toBe(true)
  })
  it('pas de rang : gainage, cardio, étirements, élastique, pompes', () => {
    expect(standardFor(ex({ id: 'plank', kind: 'duration' }))).toBeUndefined()
    expect(standardFor(ex({ id: 'run', kind: 'cardio' }))).toBeUndefined()
    expect(standardFor(ex({ id: 'fe-st', category: 'etirement' }))).toBeUndefined()
    expect(standardFor(ex({ id: 'fe-band', equipment: 'elastique' }))).toBeUndefined()
    expect(standardFor(ex({ id: 'push-up', kind: 'bodyweight', equipment: 'poids-du-corps' }))).toBeUndefined()
  })
})

describe('rangs avant / après une séance', () => {
  const exercises = [ex({ id: 'bench-press', secondary: ['triceps'] }), ex({ id: 'back-squat', muscle: 'quadriceps', secondary: ['fessiers'] })]
  const old = workout('a', 1, [['bench-press', 80, 5]])
  const today = workout('b', 2, [
    ['bench-press', 100, 5],
    ['back-squat', 100, 5],
  ])
  it('promotion sur un exercice déjà classé, premier classement sur un nouveau', () => {
    const changes = rankChanges(today, rankSnapshot(exercises, [old], body), rankSnapshot(exercises, [old, today], body))
    expect(changes.map((c) => [c.now.ex.id, c.change])).toEqual([
      ['bench-press', 'up'],
      ['back-squat', 'new'],
    ])
    expect(changes[0].tierUp).toBe(true)
  })
  it('pas de changement si la séance est moins bonne', () => {
    const easy = workout('c', 3, [['bench-press', 60, 5]])
    const changes = rankChanges(easy, rankSnapshot(exercises, [today], body), rankSnapshot(exercises, [today, easy], body))
    expect(changes[0].change).toBe('same')
  })
})
