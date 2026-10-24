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

// ---------- Rangs (Bronze → Challenger) ----------

export interface Rank {
  key: string
  name: string
  /** Lettres du badge */
  short: string
  color: string
  /** Niveau minimal, en fraction du standard de l'exercice (1 = standard atteint = Émeraude) */
  min: number
  /** Divisions IV → I, comme les rangs classés de League of Legends */
  divisions: boolean
}

export const RANKS: Rank[] = [
  { key: 'bronze', name: 'Bronze', short: 'B', color: '#B07A4F', min: 0, divisions: true },
  { key: 'argent', name: 'Argent', short: 'A', color: '#C9CDD6', min: 0.4, divisions: true },
  { key: 'or', name: 'Or', short: 'O', color: '#D6B56E', min: 0.6, divisions: true },
  { key: 'platine', name: 'Platine', short: 'P', color: '#6FC2B8', min: 0.8, divisions: true },
  { key: 'emeraude', name: 'Émeraude', short: 'É', color: '#4FBF7F', min: 1.0, divisions: true },
  { key: 'diamant', name: 'Diamant', short: 'D', color: '#8FB2E0', min: 1.2, divisions: true },
  { key: 'maitre', name: 'Maître', short: 'M', color: '#B08AD8', min: 1.45, divisions: false },
  { key: 'grand-maitre', name: 'Grand Maître', short: 'GM', color: '#E0736A', min: 1.7, divisions: false },
  { key: 'challenger', name: 'Challenger', short: 'C', color: '#F0D58C', min: 2.0, divisions: false },
]

const ROMAN = ['', 'I', 'II', 'III', 'IV']

export interface RankResult {
  rank: Rank
  next?: Rank
  /** Division 4 (IV) → 1 (I) pour les rangs divisés */
  division?: number
  /** « Or II », « Maître »… */
  label: string
  /** Palier suivant (« Or I », « Platine IV », « Grand Maître »…) */
  nextLabel?: string
  /** Niveau à atteindre pour le palier suivant */
  nextLevel?: number
  /** Progression 0..1 vers le rang suivant */
  progress: number
  /** Progression 0..1 vers le palier suivant (division ou rang) */
  stepProgress: number
  /** Index du rang + progression : sert à trier et à faire des moyennes */
  score: number
  level: number
  ratio: number
}

export interface BodyProfile {
  sex: Sex
  bodyweight: number
  heightCm?: number
  age?: number
}

export type BodyRegion = 'upper' | 'lower'

// Coefficients DOTS (force athlétique, IPF/USAPL) : comparent des athlètes de sexes et de poids différents
const DOTS: Record<Sex, number[]> = {
  male: [-0.000001093, 0.0007391293, -0.1918759221, 24.0900756, -307.75076],
  female: [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288],
}
function dotsDenominator(sex: Sex, bodyweight: number) {
  const x = Math.min(sex === 'female' ? 150 : 210, Math.max(40, bodyweight))
  const [a, b, c, d, e] = DOTS[sex]
  return a * x ** 4 + b * x ** 3 + c * x ** 2 + d * x + e
}

/** Référence des standards : homme de 80 kg et 1,76 m. */
const REF_BODYWEIGHT = 80
const REF_HEIGHT: Record<Sex, number> = { male: 176, female: 163 }
/** DOTS est calibré sur des totaux (squat + développé couché + soulevé de terre) ; l'écart femmes/hommes est plus
 *  marqué sur le haut du corps (développé couché ≈ 60–65 % à poids égal, contre ≈ 75 % pour les jambes). */
const FEMALE_UPPER = 0.85
/** Coefficients d'âge officiels de la force athlétique (repris d'OpenPowerlifting) : Foster de 14 à 22 ans,
 *  aucun entre 23 et 40, McCulloch de 41 à 90 ans. En dehors, on garde la valeur de la borne. */
const AGE_FOSTER = [1.23, 1.18, 1.13, 1.08, 1.06, 1.04, 1.03, 1.02, 1.01] // 14 → 22
const AGE_MCCULLOCH = [
  1.01, 1.02, 1.031, 1.043, 1.055, 1.068, 1.082, 1.097, 1.113, 1.13, 1.147, 1.165, 1.184, 1.204, 1.225, 1.246, 1.268, 1.291, 1.315, 1.34, 1.366, 1.393, 1.421, 1.45, 1.48, 1.511,
  1.543, 1.576, 1.61, 1.645, 1.681, 1.718, 1.756, 1.795, 1.835, 1.876, 1.918, 1.961, 2.005, 2.05, 2.096, 2.143, 2.19, 2.238, 2.287, 2.337, 2.388, 2.44, 2.494, 2.549,
] // 41 → 90

export function ageFactor(age?: number): number {
  if (!age) return 1
  const a = Math.round(age)
  if (a <= 22) return AGE_FOSTER[Math.max(0, a - 14)]
  if (a <= 40) return 1
  return AGE_MCCULLOCH[Math.min(a, 90) - 41]
}

/** Âge à partir de la seule année de naissance : comme en compétition, on retient l'âge le moins favorable
 *  (le plus haut pour un jeune, le plus bas pour un vétéran). */
export function ageFromBirthYear(birthYear: number | undefined, now = new Date()): number | undefined {
  if (!birthYear || birthYear < 1900) return undefined
  const diff = now.getFullYear() - birthYear
  return diff > 30 ? diff - 1 : diff
}

const LOWER_BODY = new Set<string>(['quadriceps', 'ischios', 'fessiers', 'mollets', 'adducteurs', 'lombaires'])

/** Haut ou bas du corps : le soulevé de terre (dos + ischios/fessiers) compte comme bas du corps. */
export function bodyRegion(ex: Pick<Exercise, 'muscle' | 'secondary'>): BodyRegion {
  return LOWER_BODY.has(ex.muscle) || ex.secondary.some((m) => m === 'quadriceps' || m === 'ischios' || m === 'fessiers') ? 'lower' : 'upper'
}

/** Multiplicateur qui ramène un 1RM à celui, de même niveau, d'un homme de 80 kg et 1,76 m, âgé de 23 à 40 ans.
 *  - sexe et poids : formule DOTS (non linéaire : les lourds ne sont pas pénalisés comme avec un simple ratio) ;
 *  - taille : à poids égal, une personne plus grande a moins de section musculaire par centimètre et des leviers
 *    plus longs ; correction modérée (racine carrée), plafonnée à ±8 % ;
 *  - âge : coefficients Foster (moins de 23 ans) et McCulloch (plus de 40 ans). */
export function strengthFactor(body: BodyProfile, region: BodyRegion = 'upper'): number {
  const dots = dotsDenominator('male', REF_BODYWEIGHT) / dotsDenominator(body.sex, body.bodyweight)
  const female = body.sex === 'female' && region === 'upper' ? 1 / FEMALE_UPPER : 1
  const height = body.heightCm && body.heightCm > 100 ? Math.min(1.08, Math.max(0.92, Math.sqrt(body.heightCm / REF_HEIGHT[body.sex]))) : 1
  return dots * female * height * ageFactor(body.age)
}

/** Rang correspondant à un niveau (fraction du standard). */
export function rankFromLevel(level: number, ratio = 0): RankResult {
  let idx = 0
  for (let i = 0; i < RANKS.length; i++) if (level >= RANKS[i].min) idx = i
  const rank = RANKS[idx]
  const next = RANKS[idx + 1]
  const progress = next ? Math.max(0, Math.min(1, (level - rank.min) / (next.min - rank.min))) : 1
  const base = { rank, next, progress, score: idx + (next ? progress : 0), level, ratio }
  const firstLabel = (r: Rank) => (r.divisions ? `${r.name} IV` : r.name)
  if (!next) return { ...base, label: rank.name, stepProgress: 1 }
  if (!rank.divisions) return { ...base, label: rank.name, nextLabel: firstLabel(next), nextLevel: next.min, stepProgress: progress }
  const step = Math.min(3, Math.floor(progress * 4 + 1e-9)) // 1e-9 : arrondis flottants pile sur un palier
  const division = 4 - step
  const span = next.min - rank.min
  return {
    ...base,
    division,
    label: `${rank.name} ${ROMAN[division]}`,
    nextLabel: division > 1 ? `${rank.name} ${ROMAN[division - 1]}` : firstLabel(next),
    nextLevel: rank.min + (span * (step + 1)) / 4,
    stepProgress: Math.max(0, Math.min(1, progress * 4 - step)),
  }
}

/** Rang moyen à partir d'un score (index du rang + progression), pour le rang global. */
export function rankFromScore(score: number): RankResult {
  const idx = Math.max(0, Math.min(RANKS.length - 1, Math.floor(score)))
  const next = RANKS[idx + 1]
  return rankFromLevel(next ? RANKS[idx].min + (score - idx) * (next.min - RANKS[idx].min) : RANKS[idx].min)
}

export function computeRank(bestE1rm: number, standard: number, body: BodyProfile, region: BodyRegion = 'upper'): RankResult | undefined {
  if (!bestE1rm || !body.bodyweight || !standard) return undefined
  const level = (bestE1rm * strengthFactor(body, region)) / (REF_BODYWEIGHT * standard)
  return rankFromLevel(level, bestE1rm / body.bodyweight)
}

/** 1RM estimé (kg) nécessaire pour atteindre un niveau donné. */
export function e1rmForLevel(level: number, standard: number, body: BodyProfile, region: BodyRegion = 'upper') {
  return (level * REF_BODYWEIGHT * standard) / strengthFactor(body, region)
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
