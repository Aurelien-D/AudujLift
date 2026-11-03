import { describe, expect, it } from 'vitest'
import { AI_PROMPT, AI_URL_MAX, assistantUrl, formatSetForAi, workoutsToMarkdown } from './ai-export'
import type { Exercise, Workout } from './types'

const ex = (id: string, name: string, muscle: Exercise['muscle'], kind: Exercise['kind'] = 'weight_reps', secondary: Exercise['secondary'] = []): Exercise => ({
  id,
  name,
  muscle,
  secondary,
  equipment: 'barre',
  kind,
})
const exMap = new Map(
  [ex('bench', 'Développé couché', 'pectoraux', 'weight_reps', ['triceps']), ex('pull', 'Tractions', 'dos', 'bodyweight'), ex('plank', 'Gainage', 'abdos', 'duration')].map((e) => [
    e.id,
    e,
  ]),
)
const day = (d: number) => new Date(2026, 9, d, 18, 0).getTime()
const w = (id: string, d: number, name: string): Workout => ({
  id,
  name,
  status: 'done',
  startedAt: day(d),
  endedAt: day(d) + 65 * 60_000,
  bodyweight: 80,
  notes: 'Bonne\nforme',
  exercises: [
    {
      uid: 'a',
      exerciseId: 'bench',
      restSec: 120,
      notes: 'prise serrée',
      sets: [
        { type: 'warmup', weight: 40, reps: 10, done: true },
        { type: 'normal', weight: 85, reps: 6, done: true, rpe: 8 },
        { type: 'normal', weight: 85, reps: 6, done: true, rpe: 8 },
        { type: 'failure', weight: 85, reps: 5, done: true },
      ],
    },
    { uid: 'b', exerciseId: 'pull', restSec: 90, sets: [{ type: 'normal', weight: 10, reps: 8, done: true }] },
    { uid: 'c', exerciseId: 'plank', restSec: 60, sets: [{ type: 'normal', duration: 60, done: true }] },
  ],
})
const profile = { sex: 'male' as const, age: 31, heightCm: 180, bodyweight: 82, goal: 'bulk' as const, weeklyGoal: 4 }

describe('export des séances pour une IA', () => {
  it('notation compacte des séries', () => {
    expect(formatSetForAi({ type: 'normal', weight: 82.5, reps: 8, done: true, rpe: 8.5 }, 'weight_reps')).toBe('82,5×8 @RPE8,5')
    expect(formatSetForAi({ type: 'normal', weight: 10, reps: 8, done: true }, 'bodyweight')).toBe('PDC+10×8')
    expect(formatSetForAi({ type: 'normal', reps: 12, done: true }, 'bodyweight')).toBe('PDC×12')
    expect(formatSetForAi({ type: 'drop', weight: 60, reps: 10, done: true }, 'weight_reps')).toBe('60×10 (dégressive)')
    expect(formatSetForAi({ type: 'normal', distance: 5, duration: 1500, done: true }, 'cardio')).toBe('5 km en 25 min')
  })
  it('séance détaillée : profil, séries regroupées, échauffement, 1RM, notes', () => {
    const md = workoutsToMarkdown({ workouts: [w('w1', 26, 'Push A')], exMap, profile, periodLabel: 'une séance' })
    expect(md).toContain(AI_PROMPT)
    expect(md).toContain('Profil : homme, 31 ans, 1,8 m, 82 kg. Objectif : prise de masse, 4 séances par semaine visées.')
    expect(md).toContain('— Push A (1 h 05,')
    expect(md).toContain('- Développé couché [pectoraux] : 85×6 @RPE8 (×2), 85×5 (échec) ; échauffement 40×10 — 1RM est. 102 kg — note : prise serrée')
    expect(md).toContain('- Tractions [dos] : PDC+10×8 — 1RM est. 114 kg')
    expect(md).toContain('- Gainage [abdos] : 60 s')
    expect(md).toContain('Note de séance : Bonne forme')
    expect(md).not.toContain('Résumé de la période')
  })
  it('plusieurs séances : ordre chronologique et résumé par muscle', () => {
    const md = workoutsToMarkdown({
      workouts: [w('w2', 26, 'Push B'), w('w1', 12, 'Push A')],
      exMap,
      profile,
      periodLabel: '4 dernières semaines',
      periodDays: 28,
      withPrompt: false,
    })
    expect(md.indexOf('Push A')).toBeLessThan(md.indexOf('Push B'))
    expect(md).not.toContain(AI_PROMPT)
    expect(md).toContain('## Résumé de la période')
    expect(md).toContain('0,5 séance(s) par semaine en moyenne sur 4 semaine(s)')
    expect(md).toMatch(/pectoraux \d/)
    expect(md).toMatch(/triceps \d/)
  })
  it('liens Claude / ChatGPT pré-remplis, sauf texte trop long', () => {
    expect(assistantUrl('claude', 'Salut')).toEqual({ url: 'https://claude.ai/new?q=Salut', prefilled: true })
    expect(assistantUrl('chatgpt', 'a b').url).toBe('https://chatgpt.com/?q=a%20b')
    const long = assistantUrl('claude', 'é'.repeat(AI_URL_MAX / 3)) // « é » encodé = 6 caractères
    expect(long.prefilled).toBe(false)
    expect(decodeURIComponent(long.url)).toContain('Je colle ci-dessous')
  })
})
