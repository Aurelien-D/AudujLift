import { describe, expect, it } from 'vitest'
import { localISO, stravaDescription } from './strava'
import type { Exercise, Workout } from './types'

const ex = (id: string, name: string, kind: Exercise['kind'] = 'weight_reps'): Exercise => ({ id, name, muscle: 'pectoraux', secondary: [], equipment: 'barre', kind })
const exMap = new Map([ex('bench', 'Développé couché'), ex('plank', 'Gainage', 'duration'), ex('pull', 'Tractions', 'bodyweight')].map((e) => [e.id, e]))
const start = new Date(2026, 9, 27, 18, 5, 9).getTime()
const workout: Workout = {
  id: 'w',
  name: 'Push A',
  status: 'done',
  startedAt: start,
  endedAt: start + 65 * 60_000,
  exercises: [
    {
      uid: 'a',
      exerciseId: 'bench',
      restSec: 90,
      sets: [
        { type: 'warmup', weight: 40, reps: 10, done: true },
        { type: 'normal', weight: 90, reps: 6, done: true },
        { type: 'normal', weight: 100, reps: 4, done: true },
      ],
    },
    { uid: 'b', exerciseId: 'plank', restSec: 60, sets: [{ type: 'normal', duration: 75, done: true }] },
    { uid: 'c', exerciseId: 'pull', restSec: 90, sets: [{ type: 'normal', reps: 10, done: true }] },
  ],
}

describe('Strava', () => {
  it('date locale sans fuseau', () => {
    expect(localISO(start)).toBe('2026-10-27T18:05:09')
  })
  it('description : exercices, meilleure série, totaux, records et rangs', () => {
    const d = stravaDescription(workout, exMap, [{ exerciseId: 'bench', label: '1RM estimé', value: '113,3 kg' }], ['Développé couché : Émeraude I'])
    expect(d).toContain('• Développé couché : 2 séries · 100 kg × 4')
    expect(d).toContain('• Gainage : 1 série · 1 min 15 s')
    expect(d).toContain('• Tractions : 1 série · 10 reps')
    expect(d).toContain('1 h 05')
    expect(d).toContain('🏆 1 record : Développé couché (1RM estimé 113,3 kg)')
    expect(d).toContain('⬆️ Développé couché : Émeraude I')
    expect(d.endsWith('Enregistré avec AudujLift')).toBe(true)
  })
})
