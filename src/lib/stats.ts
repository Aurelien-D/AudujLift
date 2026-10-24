import type { Exercise, Sex, SetData, Workout, WorkoutSet } from './types'
import { formatNumber, startOfWeek } from './utils'

/** 1RM estimé (formule d'Epley). Au-delà de 12 reps la précision chute mais reste indicative. */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + Math.min(reps, 20) / 30)
}

/** Charge effective d'une série (inclut le poids de corps pour les exercices au poids du corps). */
export function effectiveLoad(set: SetData, kind: Exercise['kind'], bodyweight = 0): number {
  if (kind === 'bodyweight') return bodyweight + (set.weight ?? 0)
  return set.weight ?? 0
}

export function setVolume(set: SetData, kind: Exercise['kind'], bodyweight = 0): number {
  if (kind !== 'weight_reps' && kind !== 'bodyweight') return 0
  return effectiveLoad(set, kind, bodyweight) * (set.reps ?? 0)
}

const counts = (s: WorkoutSet) => s.done && s.type !== 'warmup'

export interface WorkoutTotals {
  volume: number
  sets: number
  reps: number
  durationMs: number
}

export function workoutTotals(w: Workout, exercises: Map<string, Exercise>): WorkoutTotals {
  let volume = 0
  let sets = 0
  let reps = 0
  for (const we of w.exercises) {
    const kind = exercises.get(we.exerciseId)?.kind ?? 'weight_reps'
    for (const s of we.sets) {
      if (!counts(s)) continue
      sets++
      reps += s.reps ?? 0
      // Pour le volume on ne compte que la charge ajoutée sur les exos au poids du corps
      if (kind === 'weight_reps' || kind === 'bodyweight') volume += (s.weight ?? 0) * (s.reps ?? 0)
    }
  }
  return { volume, sets, reps, durationMs: (w.endedAt ?? Date.now()) - w.startedAt }
}

export interface ExerciseSession {
  workoutId: string
  date: number
  sets: WorkoutSet[]
  bodyweight?: number
  bestE1rm: number
  maxWeight: number
  volume: number
  maxReps: number
  maxDuration: number
  maxDistance: number
}

/** Historique d'un exercice, du plus récent au plus ancien. */
export function exerciseHistory(exercise: Exercise, workouts: Workout[], fallbackBw = 0): ExerciseSession[] {
  const out: ExerciseSession[] = []
  for (const w of workouts) {
    if (w.status !== 'done') continue
    const sets = w.exercises.filter((e) => e.exerciseId === exercise.id).flatMap((e) => e.sets.filter(counts))
    if (!sets.length) continue
    const bw = w.bodyweight ?? fallbackBw
    let bestE1rm = 0
    let maxWeight = 0
    let volume = 0
    let maxReps = 0
    let maxDuration = 0
    let maxDistance = 0
    for (const s of sets) {
      const load = effectiveLoad(s, exercise.kind, bw)
      bestE1rm = Math.max(bestE1rm, e1rm(load, s.reps ?? 0))
      maxWeight = Math.max(maxWeight, s.weight ?? 0)
      volume += setVolume(s, exercise.kind, bw)
      maxReps = Math.max(maxReps, s.reps ?? 0)
      maxDuration = Math.max(maxDuration, s.duration ?? 0)
      maxDistance = Math.max(maxDistance, s.distance ?? 0)
    }
    out.push({ workoutId: w.id, date: w.startedAt, sets, bodyweight: bw, bestE1rm, maxWeight, volume, maxReps, maxDuration, maxDistance })
  }
  return out.sort((a, b) => b.date - a.date)
}

export interface PersonalRecords {
  bestE1rm?: { value: number; date: number }
  maxWeight?: { value: number; reps: number; date: number }
  bestVolumeSession?: { value: number; date: number }
  maxReps?: { value: number; date: number }
  /** Meilleure charge pour 1..12 reps */
  repMaxes: Record<number, { weight: number; date: number }>
}

export function personalRecords(history: ExerciseSession[]): PersonalRecords {
  const pr: PersonalRecords = { repMaxes: {} }
  for (const s of history) {
    if (s.bestE1rm && (!pr.bestE1rm || s.bestE1rm > pr.bestE1rm.value)) pr.bestE1rm = { value: s.bestE1rm, date: s.date }
    if (s.volume && (!pr.bestVolumeSession || s.volume > pr.bestVolumeSession.value)) pr.bestVolumeSession = { value: s.volume, date: s.date }
    if (s.maxReps && (!pr.maxReps || s.maxReps > pr.maxReps.value)) pr.maxReps = { value: s.maxReps, date: s.date }
    for (const set of s.sets) {
      const w = set.weight ?? 0
      const r = set.reps ?? 0
      if (w > 0 && (!pr.maxWeight || w > pr.maxWeight.value || (w === pr.maxWeight.value && r > pr.maxWeight.reps))) pr.maxWeight = { value: w, reps: r, date: s.date }
      if (w > 0 && r >= 1 && r <= 12) {
        const cur = pr.repMaxes[r]
        if (!cur || w > cur.weight) pr.repMaxes[r] = { weight: w, date: s.date }
      }
    }
  }
  return pr
}

export interface PRHit {
  exerciseId: string
  label: string
  value: string
  /** Ancien record battu */
  previous?: string
}

/** Records battus dans une séance par rapport à toutes les séances précédentes. */
export function detectPRs(workout: Workout, previous: Workout[], exercises: Map<string, Exercise>, bw = 0): PRHit[] {
  const hits: PRHit[] = []
  const before = previous.filter((w) => w.status === 'done' && w.id !== workout.id && w.startedAt < workout.startedAt)
  const done = { ...workout, status: 'done' as const }
  for (const exId of new Set(workout.exercises.map((e) => e.exerciseId))) {
    const ex = exercises.get(exId)
    if (!ex || (ex.kind !== 'weight_reps' && ex.kind !== 'bodyweight')) continue
    const prevHist = exerciseHistory(ex, before, bw)
    if (!prevHist.length) continue // première fois : pas de « record »
    const now = exerciseHistory(ex, [done], bw)[0]
    if (!now) continue
    const prev = personalRecords(prevHist)
    const kg = (v: number | undefined, d = 1) => (v ? `${formatNumber(v, d)} kg` : undefined)
    if (now.bestE1rm > (prev.bestE1rm?.value ?? 0) + 0.01)
      hits.push({ exerciseId: exId, label: '1RM estimé', value: `${formatNumber(now.bestE1rm)} kg`, previous: kg(prev.bestE1rm?.value) })
    if (ex.kind === 'weight_reps' && now.maxWeight > (prev.maxWeight?.value ?? 0))
      hits.push({ exerciseId: exId, label: 'Charge max', value: `${formatNumber(now.maxWeight)} kg`, previous: kg(prev.maxWeight?.value) })
    if (now.volume > (prev.bestVolumeSession?.value ?? 0) + 0.01)
      hits.push({ exerciseId: exId, label: 'Volume', value: `${formatNumber(now.volume, 0)} kg`, previous: kg(prev.bestVolumeSession?.value, 0) })
  }
  return hits
}

// ---------- Rangs (inspirés de Liftoff) ----------

export interface Rank {
  key: string
  name: string
  color: string
  min: number // fraction du standard Platine
}

export const RANKS: Rank[] = [
  { key: 'fer', name: 'Fer', color: '#7D828E', min: 0 },
  { key: 'bronze', name: 'Bronze', color: '#B07A4F', min: 0.4 },
  { key: 'argent', name: 'Argent', color: '#C9CDD6', min: 0.6 },
  { key: 'or', name: 'Or', color: '#D6B56E', min: 0.8 },
  { key: 'platine', name: 'Platine', color: '#9FC7C2', min: 1.0 },
  { key: 'diamant', name: 'Diamant', color: '#8FB2E0', min: 1.25 },
  { key: 'champion', name: 'Champion', color: '#A58AD0', min: 1.5 },
  { key: 'titan', name: 'Titan', color: '#D9776C', min: 1.75 },
  { key: 'legende', name: 'Légende', color: '#E8D3A1', min: 2.0 },
]

export interface RankResult {
  rank: Rank
  next?: Rank
  /** progression 0..1 vers le rang suivant */
  progress: number
  ratio: number
}

export function computeRank(bestE1rm: number, bodyweight: number, standard: number, sex: Sex): RankResult | undefined {
  if (!bestE1rm || !bodyweight || !standard) return undefined
  const std = standard * (sex === 'female' ? 0.62 : 1)
  const level = bestE1rm / bodyweight / std
  let idx = 0
  for (let i = 0; i < RANKS.length; i++) if (level >= RANKS[i].min) idx = i
  const rank = RANKS[idx]
  const next = RANKS[idx + 1]
  const progress = next ? (level - rank.min) / (next.min - rank.min) : 1
  return { rank, next, progress: Math.max(0, Math.min(1, progress)), ratio: bestE1rm / bodyweight }
}

/** Poids (kg) nécessaire en e1RM pour atteindre un rang donné. */
export function e1rmForRank(rank: Rank, bodyweight: number, standard: number, sex: Sex) {
  return rank.min * standard * (sex === 'female' ? 0.62 : 1) * bodyweight
}

// ---------- Régularité ----------

/** Nombre de semaines consécutives où l'objectif hebdo a été atteint (semaine en cours incluse si atteinte). */
export function weeklyStreak(workoutDates: number[], goal: number, now = new Date()): number {
  if (goal <= 0) return 0
  const byWeek = new Map<number, number>()
  for (const ts of workoutDates) {
    const k = startOfWeek(new Date(ts)).getTime()
    byWeek.set(k, (byWeek.get(k) ?? 0) + 1)
  }
  const week = startOfWeek(now)
  let streak = (byWeek.get(week.getTime()) ?? 0) >= goal ? 1 : 0
  const cursor = new Date(week)
  for (;;) {
    cursor.setDate(cursor.getDate() - 7)
    if ((byWeek.get(cursor.getTime()) ?? 0) >= goal) streak++
    else break
  }
  return streak
}

// ---------- Calculateur de disques ----------

/** Disques à mettre de chaque côté de la barre (algorithme glouton). */
export function platesPerSide(target: number, bar: number, plates: number[]): { plates: number[]; remainder: number } {
  let side = (target - bar) / 2
  const out: number[] = []
  if (side <= 0) return { plates: out, remainder: Math.max(0, target - bar) }
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side >= p - 1e-9) {
      out.push(p)
      side -= p
    }
  }
  return { plates: out, remainder: Math.round(side * 2 * 100) / 100 }
}

// ---------- Tableau de bord ----------

/** Records battus depuis `since`, du plus récent au plus ancien. */
export function recentPRs(workouts: Workout[], exercises: Map<string, Exercise>, since: number): { hit: PRHit; date: number; workoutId: string }[] {
  const out: { hit: PRHit; date: number; workoutId: string }[] = []
  for (const w of workouts) {
    if (w.status !== 'done' || w.startedAt < since) continue
    for (const hit of detectPRs(w, workouts, exercises, w.bodyweight)) out.push({ hit, date: w.startedAt, workoutId: w.id })
  }
  return out.sort((a, b) => b.date - a.date)
}

/** Volume (kg) des séances comprises dans [from, to[. */
export function volumeBetween(workouts: Workout[], exercises: Map<string, Exercise>, from: number, to: number): number {
  return workouts.filter((w) => w.status === 'done' && w.startedAt >= from && w.startedAt < to).reduce((v, w) => v + workoutTotals(w, exercises).volume, 0)
}
