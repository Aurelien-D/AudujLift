import { describe, expect, it } from 'vitest'
import { buildSharePayload, decodeShare, encodeShare, extractShareCode, planImport, sharedRoutineExercises } from './share'
import type { Exercise, Routine } from './types'

const bench: Exercise = {
  id: 'bench-press',
  name: 'Développé couché (barre)',
  muscle: 'pectoraux',
  secondary: ['triceps'],
  equipment: 'barre',
  kind: 'weight_reps',
  standard: 1.25,
}
const machine: Exercise = {
  id: 'custom-abc',
  name: 'Presse Hammer pectoraux',
  muscle: 'pectoraux',
  secondary: [],
  equipment: 'machine',
  kind: 'weight_reps',
  custom: true,
  photo: 'data:image/jpeg;base64,AAAA',
}
const routine: Routine = {
  id: 'r1',
  name: 'Push A',
  createdAt: 0,
  updatedAt: 0,
  exercises: [
    {
      uid: 'a',
      exerciseId: 'bench-press',
      restSec: 150,
      sets: [
        { type: 'normal', weight: 80, reps: 8 },
        { type: 'normal', weight: 80, reps: 8 },
      ],
    },
    { uid: 'b', exerciseId: 'custom-abc', restSec: 90, notes: 'Siège cran 3', sets: [{ type: 'normal', reps: 12 }] },
  ],
}
const map = new Map([bench, machine].map((e) => [e.id, e]))

describe('partage de routine', () => {
  it('ne partage ni les charges ni les photos perso', () => {
    const p = buildSharePayload(routine, map, 'Aurélien')
    expect(p.from).toBe('Aurélien')
    expect(p.routine.exercises[0].sets[0]).toEqual({ type: 'normal', reps: 8, duration: undefined, distance: undefined })
    expect(JSON.stringify(p)).not.toContain('base64')
    expect(p.routine.exercises[1].exercise.notes).toBeUndefined()
    expect(p.routine.exercises[1].notes).toBe('Siège cran 3')
  })

  it('encode et décode un lien compact', async () => {
    const p = buildSharePayload(routine, map, 'Aurélien')
    const code = await encodeShare(p)
    expect(code[0]).toBe('z')
    expect(code.length).toBeLessThan(600)
    expect(await decodeShare(code)).toEqual(JSON.parse(JSON.stringify(p)))
  })

  it('retrouve le code dans un lien collé', () => {
    expect(extractShareCode('Regarde ma routine : https://x.github.io/AudujLift/#/share?d=zAbC_d-12345 !')).toBe('zAbC_d-12345')
    expect(extractShareCode('zAbC_d-12345')).toBe('zAbC_d-12345')
    expect(extractShareCode('bonjour')).toBeNull()
  })

  it('refuse un lien abîmé', async () => {
    await expect(decodeShare('zpas-un-vrai-code')).rejects.toThrow(/illisible/)
  })

  it('relie les exercices existants et crée les exercices perso manquants', async () => {
    const p = await decodeShare(await encodeShare(buildSharePayload(routine, map, 'Aurélien')))
    const friendHasBench = [bench]
    const { mapping, toCreate } = planImport(p, friendHasBench)
    expect(mapping.get('bench-press')).toBe('bench-press')
    expect(toCreate).toHaveLength(1)
    expect(toCreate[0]).toMatchObject({ id: 'custom-abc', name: 'Presse Hammer pectoraux', custom: true })
    const res = sharedRoutineExercises(p, mapping, () => 'u')
    expect(res.map((r) => r.exerciseId)).toEqual(['bench-press', 'custom-abc'])
    // déjà importé une fois : rien n'est recréé (même nom)
    expect(planImport(p, [bench, { ...toCreate[0], id: 'custom-zzz' }]).toCreate).toHaveLength(0)
  })
})
