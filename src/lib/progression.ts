import type { Exercise, RoutineExercise, SetData } from './types'

/** Pas de progression automatique (kg). */
export const PROGRESSION_STEP = 2.5

/** Arrondi à la charge réalisable la plus proche (multiples de 2,5 kg par défaut). */
export function roundLoad(kg: number, step = 2.5): number {
  return Math.round(kg / step) * step
}

/**
 * Surcharge progressive : si toutes les séries de travail de la dernière séance ont atteint l'objectif
 * de répétitions à la même charge, on propose la charge + 2,5 kg.
 * Ne s'applique que si la routine fixe un objectif de reps sans imposer de charge.
 */
export function progressedWeight(template: SetData[], last: SetData[] | undefined, step = PROGRESSION_STEP): { from: number; to: number } | undefined {
  if (!last) return undefined
  const work = template.filter((s) => s.type === 'normal')
  const prev = last.filter((s) => s.type === 'normal')
  if (!work.length || prev.length < work.length) return undefined
  if (work.some((s) => s.weight != null || !s.reps)) return undefined
  const done = prev.slice(0, work.length)
  const top = done[0].weight ?? 0
  if (top <= 0 || done.some((s) => (s.weight ?? 0) !== top)) return undefined
  const allReps = work.every((s, i) => (done[i].reps ?? 0) >= (s.reps ?? 0))
  return allReps ? { from: top, to: top + step } : undefined
}

/**
 * Séries d'échauffement pour une charge de travail : barre à vide, puis 50 %, 70 % et 85 %.
 * Les paliers trop proches (ou sous la barre) sont fusionnés.
 */
export function warmupSets(workWeight: number, bar: number, withBar: boolean): SetData[] {
  if (!workWeight || workWeight <= 0) return []
  const out: SetData[] = []
  if (withBar && workWeight > bar) out.push({ type: 'warmup', weight: bar, reps: 10 })
  for (const [pct, reps] of [
    [0.5, 8],
    [0.7, 5],
    [0.85, 3],
  ] as const) {
    const w = roundLoad(workWeight * pct)
    const floor = withBar ? bar : 0
    if (w <= floor || w >= workWeight) continue
    if (out.some((s) => Math.abs((s.weight ?? 0) - w) < 2.5)) continue
    out.push({ type: 'warmup', weight: w, reps })
  }
  return out
}

/** Le matériel utilise-t-il une barre (échauffement « barre à vide ») ? */
export const usesBar = (e: Pick<Exercise, 'equipment'>) => e.equipment === 'barre' || e.equipment === 'smith' || e.equipment === 'barre-ez'

/** Durée estimée d'une séance : ~40 s d'effort par série + le repos prévu entre les séries. */
export function estimateDurationMin(exercises: Pick<RoutineExercise, 'sets' | 'restSec'>[]): number {
  let sec = 0
  for (const e of exercises) {
    const n = Math.max(1, e.sets.length)
    sec += n * 40 + Math.max(0, n - 1) * e.restSec + 60 // + mise en place
  }
  return Math.max(5, Math.round(sec / 300) * 5)
}
