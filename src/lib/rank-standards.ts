// Barème des rangs pour chaque exercice, et photo des rangs à un instant donné (avant / après une séance).
import { DEFAULT_EXERCISES } from './exercises-data'
import { bodyRegion, computeRank, exerciseHistory, personalRecords, rankFromScore, type BodyProfile, type RankResult } from './stats'
import type { Equipment, Exercise, MuscleGroup, Workout } from './types'

export interface RankStandard {
  value: number
  /** Barème déduit d'exercices comparables (même muscle, même matériel, poly- ou mono-articulaire) */
  estimated: boolean
}

// Les standards de la base font foi même si l'exercice a été enregistré avec une ancienne valeur
const CORE = new Map(DEFAULT_EXERCISES.filter((e) => e.standard).map((e) => [e.id, e.standard!]))

// Matériel dont la charge se compare à celui d'un exercice de base (kettlebell ≈ haltère, Smith ≈ barre)
const EQUIPMENT_GROUP: Partial<Record<Equipment, Equipment>> = {
  barre: 'barre',
  smith: 'barre',
  'barre-ez': 'barre-ez',
  halteres: 'halteres',
  kettlebell: 'halteres',
  poulie: 'poulie',
  machine: 'machine',
}
const RANKABLE_CATEGORIES = new Set([undefined, 'force', 'powerlifting', 'halterophilie', 'strongman'])

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

// Estimations par (muscle, matériel, poly-articulaire), puis (muscle, poly-articulaire)
const ESTIMATES = (() => {
  const groups = new Map<string, number[]>()
  const push = (k: string, v: number) => groups.set(k, [...(groups.get(k) ?? []), v])
  for (const e of DEFAULT_EXERCISES) {
    const eq = EQUIPMENT_GROUP[e.equipment]
    if (!e.standard || e.kind !== 'weight_reps' || !eq) continue
    const compound = e.secondary.length > 0
    push(`${e.muscle}|${eq}|${compound}`, e.standard)
    push(`${e.muscle}|${compound}`, e.standard)
  }
  return new Map([...groups].map(([k, v]) => [k, median(v)]))
})()

function estimate(muscle: MuscleGroup, equipment: Equipment, compound: boolean): number | undefined {
  const eq = EQUIPMENT_GROUP[equipment]
  if (!eq) return undefined
  return ESTIMATES.get(`${muscle}|${eq}|${compound}`) ?? ESTIMATES.get(`${muscle}|${compound}`)
}

/** Barème d'un exercice : celui de la base, celui hérité (variante), sinon une estimation pour les exercices
 *  de force à charge mesurable. Pas de barème pour le gainage, le cardio, les étirements, les élastiques… */
export function standardFor(ex: Exercise): RankStandard | undefined {
  const core = CORE.get(ex.id)
  if (core) return { value: core, estimated: false }
  if (ex.standard) return { value: ex.standard, estimated: false }
  if (ex.kind !== 'weight_reps' || !RANKABLE_CATEGORIES.has(ex.category)) return undefined
  const value = estimate(ex.muscle, ex.equipment, ex.secondary.length > 0)
  return value ? { value, estimated: true } : undefined
}

/** Pourquoi un exercice n'a pas de rang (affiché dans sa fiche). */
export function unrankedReason(ex: Exercise): string {
  if (ex.kind === 'duration') return 'Les exercices chronométrés (gainage, étirements…) n’ont pas de rang : la durée ne se compare pas à une charge.'
  if (ex.kind === 'cardio') return 'Le cardio n’a pas de rang : distance et durée ne se comparent pas à une charge.'
  if (ex.kind === 'bodyweight') return 'Les exercices au poids du corps sans barème (pompes, abdos…) se font souvent en longues séries : un 1RM n’y a pas de sens.'
  if (ex.category === 'etirement' || ex.category === 'plyometrie') return 'Les étirements et la pliométrie n’ont pas de rang.'
  return 'Pas d’exercice comparable pour estimer un barème (élastique, ballon, matériel « autre »…).'
}

export interface RankedExercise {
  ex: Exercise
  rank: RankResult
  e1rm: number
  standard: number
  estimated: boolean
}

export interface RankSnapshot {
  byExercise: Map<string, RankedExercise>
  byMuscle: Map<MuscleGroup, RankedExercise>
  overall?: RankResult
}

/** Rangs de tous les exercices d'après un historique de séances. */
export function rankSnapshot(exercises: Exercise[], workouts: Workout[], body: BodyProfile): RankSnapshot {
  const byExercise = new Map<string, RankedExercise>()
  const used = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))
  for (const ex of exercises) {
    if (!used.has(ex.id)) continue
    const std = standardFor(ex)
    if (!std) continue
    const pr = personalRecords(exerciseHistory(ex, workouts, body.bodyweight))
    if (!pr.bestE1rm) continue
    const rank = computeRank(pr.bestE1rm.value, std.value, body, bodyRegion(ex))
    if (rank) byExercise.set(ex.id, { ex, rank, e1rm: pr.bestE1rm.value, standard: std.value, estimated: std.estimated })
  }
  const byMuscle = new Map<MuscleGroup, RankedExercise>()
  for (const r of byExercise.values()) {
    const cur = byMuscle.get(r.ex.muscle)
    if (!cur || r.rank.score > cur.rank.score) byMuscle.set(r.ex.muscle, r)
  }
  const overall = byMuscle.size ? rankFromScore([...byMuscle.values()].reduce((s, r) => s + r.rank.score, 0) / byMuscle.size) : undefined
  return { byExercise, byMuscle, overall }
}

export interface RankChange {
  now: RankedExercise
  before?: RankResult
  /** new : premier classement ; up : division ou rang gagné ; same : pas de changement */
  change: 'new' | 'up' | 'same'
  /** Changement de rang (pas seulement de division) */
  tierUp: boolean
}

/** Rangs des exercices d'une séance, comparés à ceux d'avant la séance. */
export function rankChanges(workout: Workout, before: RankSnapshot, after: RankSnapshot): RankChange[] {
  const ids = [...new Set(workout.exercises.map((e) => e.exerciseId))]
  return ids.flatMap((id) => {
    const now = after.byExercise.get(id)
    if (!now) return []
    const prev = before.byExercise.get(id)?.rank
    const up = !!prev && now.rank.score > prev.score && now.rank.label !== prev.label
    return [{ now, before: prev, change: !prev ? 'new' : up ? 'up' : 'same', tierUp: !!prev && now.rank.rank.key !== prev.rank.key && up } as RankChange]
  })
}
