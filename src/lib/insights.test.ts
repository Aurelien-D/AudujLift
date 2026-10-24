import { describe, expect, it } from 'vitest'
import { detectStagnation, e1rmFromRpe, muscleSets, muscleStatus, rpeLoadSuggestion } from './insights'
import { exerciseHistory } from './stats'
import type { Exercise, Workout } from './types'

const bench: Exercise = { id: 'bench', name: 'Développé couché', muscle: 'pectoraux', secondary: ['triceps', 'epaules'], equipment: 'barre', kind: 'weight_reps' }
const curl: Exercise = { id: 'curl', name: 'Curl', muscle: 'biceps', secondary: ['avant-bras'], equipment: 'halteres', kind: 'weight_reps' }
const map = new Map([bench, curl].map((e) => [e.id, e]))

function w(id: string, day: number, sets: [number, number][], exerciseId = 'bench'): Workout {
  return {
    id,
    name: 'Séance',
    status: 'done',
    startedAt: new Date(2026, 0, day, 18).getTime(),
    exercises: [{ uid: id, exerciseId, restSec: 120, sets: sets.map(([weight, reps]) => ({ type: 'normal', weight, reps, done: true })) }],
  }
}

describe('volume par muscle', () => {
  it('compte les séries de travail, les secondaires pour moitié', () => {
    const ws = [
      w('a', 5, [
        [60, 8],
        [60, 8],
        [60, 8],
      ]),
      {
        ...w(
          'b',
          6,
          [
            [12, 10],
            [12, 10],
          ],
          'curl',
        ),
      },
    ]
    const m = muscleSets(ws, map, new Date(2026, 0, 5).getTime(), new Date(2026, 0, 12).getTime())
    expect(m.get('pectoraux')).toBe(3)
    expect(m.get('triceps')).toBe(1.5)
    expect(m.get('biceps')).toBe(2)
    expect(m.get('avant-bras')).toBe(1)
  })
  it('classe selon la fourchette conseillée', () => {
    expect(muscleStatus('pectoraux', 0)).toBe('none')
    expect(muscleStatus('pectoraux', 6)).toBe('low')
    expect(muscleStatus('pectoraux', 14)).toBe('optimal')
    expect(muscleStatus('pectoraux', 24)).toBe('high')
    expect(muscleStatus('avant-bras', 5)).toBe('optimal')
  })
})

describe('stagnation', () => {
  it('détecte 3 séances sans dépasser le record', () => {
    const ws = [w('1', 1, [[80, 8]]), w('2', 4, [[80, 7]]), w('3', 8, [[80, 8]]), w('4', 11, [[77.5, 8]])]
    const s = detectStagnation('bench', exerciseHistory(bench, ws))
    expect(s).toMatchObject({ sessions: 3, lastWeight: 77.5, deloadWeight: 70 })
  })
  it('pas de stagnation quand ça progresse ou sans historique suffisant', () => {
    const ws = [w('1', 1, [[80, 8]]), w('2', 4, [[80, 8]]), w('3', 8, [[80, 8]]), w('4', 11, [[82.5, 8]])]
    expect(detectStagnation('bench', exerciseHistory(bench, ws))).toBeUndefined()
    expect(detectStagnation('bench', exerciseHistory(bench, ws.slice(0, 3)))).toBeUndefined()
  })
})

describe('charge conseillée selon le RPE', () => {
  it('série trop dure (RPE 10) : on allège', () => {
    expect(rpeLoadSuggestion({ weight: 80, reps: 8, rpe: 10 }, { weight: 80, reps: 8 })).toBe(75)
  })
  it('série trop facile (RPE 6) : on charge', () => {
    expect(rpeLoadSuggestion({ weight: 80, reps: 8, rpe: 6 }, { weight: 80, reps: 8 })).toBe(85)
  })
  it('effort visé (RPE 8) : rien à changer', () => {
    expect(rpeLoadSuggestion({ weight: 80, reps: 8, rpe: 8 }, { weight: 80, reps: 8 })).toBeUndefined()
  })
  it('1RM estimé avec les reps en réserve', () => {
    expect(e1rmFromRpe(100, 1, 10)).toBeCloseTo(103.33, 1)
    expect(e1rmFromRpe(80, 8, 8)).toBeCloseTo(106.67, 1)
  })
})
