// Analyses d'entraînement : volume par muscle, stagnation, charge conseillée selon le RPE.
import { roundLoad } from './progression'
import { exerciseHistory, type ExerciseSession } from './stats'
import type { Exercise, MuscleGroup, Workout } from './types'

// ---------- Volume par muscle ----------

/** Muscles secondaires comptés pour une demi-série (convention courante). */
const SECONDARY_WEIGHT = 0.5

/** Petits groupes : une fourchette plus basse suffit (ils travaillent déjà dans les mouvements composés). */
const MINOR: MuscleGroup[] = ['avant-bras', 'lombaires', 'adducteurs', 'trapezes', 'mollets', 'abdos']

/** Fourchette de séries hebdomadaires visée (séries de travail). */
export function weeklyTarget(m: MuscleGroup): [number, number] {
  return MINOR.includes(m) ? [4, 12] : [10, 20]
}

export type MuscleStatus = 'none' | 'low' | 'optimal' | 'high'

export function muscleStatus(m: MuscleGroup, sets: number): MuscleStatus {
  const [lo, hi] = weeklyTarget(m)
  if (sets <= 0) return 'none'
  if (sets < lo) return 'low'
  if (sets > hi) return 'high'
  return 'optimal'
}

/** Séries de travail par muscle entre `from` et `to` (muscles secondaires à 0,5). */
export function muscleSets(workouts: Workout[], exercises: Map<string, Exercise>, from: number, to: number): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>()
  const add = (m: MuscleGroup, n: number) => out.set(m, (out.get(m) ?? 0) + n)
  for (const w of workouts) {
    if (w.status !== 'done' || w.startedAt < from || w.startedAt >= to) continue
    for (const we of w.exercises) {
      const ex = exercises.get(we.exerciseId)
      if (!ex) continue
      const n = we.sets.filter((s) => s.done && s.type !== 'warmup').length
      if (!n) continue
      add(ex.muscle, n)
      for (const s of ex.secondary) if (s !== ex.muscle) add(s, n * SECONDARY_WEIGHT)
    }
  }
  return out
}

// ---------- Stagnation ----------

export interface Stagnation {
  exerciseId: string
  /** Meilleur 1RM estimé avant les dernières séances */
  best: number
  /** Nombre de séances consécutives sans progrès */
  sessions: number
  /** Charge de travail actuelle (meilleure charge de la dernière séance) */
  lastWeight: number
  /** Charge proposée pour une semaine allégée (−10 %) */
  deloadWeight: number
}

/**
 * Stagnation : les 3 dernières séances d'un exercice n'ont pas dépassé le meilleur 1RM estimé atteint avant elles.
 * `history` est trié du plus récent au plus ancien (comme `exerciseHistory`).
 */
export function detectStagnation(exerciseId: string, history: ExerciseSession[], window = 3): Stagnation | undefined {
  const withLoad = history.filter((s) => s.bestE1rm > 0)
  if (withLoad.length < window + 1) return undefined
  const recent = withLoad.slice(0, window)
  const before = withLoad.slice(window)
  const best = Math.max(...before.map((s) => s.bestE1rm))
  const recentBest = Math.max(...recent.map((s) => s.bestE1rm))
  if (recentBest > best * 1.005) return undefined
  const lastWeight = recent[0].maxWeight
  if (!lastWeight) return undefined
  return { exerciseId, best, sessions: window, lastWeight, deloadWeight: Math.max(0, roundLoad(lastWeight * 0.9)) }
}

/** Exercices en stagnation parmi ceux travaillés ces 30 derniers jours. */
export function stagnations(workouts: Workout[], exercises: Map<string, Exercise>, now = Date.now()): Stagnation[] {
  const recentIds = new Set<string>()
  for (const w of workouts) if (w.status === 'done' && now - w.startedAt < 30 * 86400000) for (const e of w.exercises) recentIds.add(e.exerciseId)
  const out: Stagnation[] = []
  for (const id of recentIds) {
    const ex = exercises.get(id)
    if (!ex || ex.kind !== 'weight_reps') continue
    const s = detectStagnation(id, exerciseHistory(ex, workouts))
    if (s) out.push(s)
  }
  return out
}

// ---------- Charge conseillée selon le RPE ----------

/** 1RM estimé à partir d'une série et de son RPE (reps en réserve = 10 − RPE), formule d'Epley. */
export function e1rmFromRpe(weight: number, reps: number, rpe: number): number {
  const toFailure = reps + Math.max(0, 10 - rpe)
  return weight * (1 + toFailure / 30)
}

/**
 * Charge à viser pour `targetReps` répétitions à `targetRpe` (8 par défaut : 2 reps en réserve),
 * d'après la dernière série notée. Renvoie undefined si l'écart est inférieur à un palier de 2,5 kg.
 */
export function rpeLoadSuggestion(last: { weight: number; reps: number; rpe: number }, planned: { weight?: number; reps: number }, targetRpe = 8): number | undefined {
  if (!last.weight || !last.reps || !planned.reps) return undefined
  const max = e1rmFromRpe(last.weight, last.reps, last.rpe)
  const ideal = roundLoad(max / (1 + (planned.reps + (10 - targetRpe)) / 30))
  const current = planned.weight ?? last.weight
  if (ideal <= 0 || Math.abs(ideal - current) < 2.5) return undefined
  return ideal
}
