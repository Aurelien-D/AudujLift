// Bilan hebdomadaire : uniquement des données réelles de l'utilisateur.
import { MUSCLE_LABELS } from './exercises-data'
import { muscleSets, weeklyTarget } from './insights'
import { recentPRs, volumeBetween, workoutTotals, type PRHit } from './stats'
import type { BodyWeight, Exercise, FoodEntry, MuscleGroup, Settings, Workout } from './types'
import { addDays, formatNumber, fromISODate, startOfWeek, toISODate } from './utils'

const DAY = 86400000
const MAIN: MuscleGroup[] = ['pectoraux', 'dos', 'epaules', 'quadriceps', 'ischios', 'fessiers', 'biceps', 'triceps']

export interface WeekSummary {
  start: Date
  /** Lundi suivant (exclu) */
  end: Date
  sessions: number
  goal: number
  durationMs: number
  volume: number
  prevVolume: number
  records: { hit: PRHit; date: number; workoutId: string }[]
  muscles: Map<MuscleGroup, number>
  nutrition: { days: number; kcal: number; protein: number; kcalGoal: number; proteinGoal: number }
  weight: { avg?: number; prevAvg?: number }
  tip: string
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

/** Lundi de la semaine située `weeksAgo` semaines avant `now`. */
export function weekStart(weeksAgo: number, now = new Date()): Date {
  const d = startOfWeek(now)
  d.setDate(d.getDate() - weeksAgo * 7)
  return d
}

export function weekSummary(p: {
  start: Date
  workouts: Workout[]
  exercises: Map<string, Exercise>
  entries: FoodEntry[]
  bodyweights: BodyWeight[]
  settings: Pick<Settings, 'weeklyWorkoutGoal' | 'goals'>
}): WeekSummary {
  const start = p.start
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const from = start.getTime()
  const to = end.getTime()
  const prevFrom = from - 7 * DAY
  const week = p.workouts.filter((w) => w.status === 'done' && w.startedAt >= from && w.startedAt < to)

  const startIso = toISODate(start)
  const endIso = toISODate(end)
  const byDay = new Map<string, { kcal: number; protein: number }>()
  for (const e of p.entries) {
    if (e.date < startIso || e.date >= endIso) continue
    const d = byDay.get(e.date) ?? { kcal: 0, protein: 0 }
    d.kcal += e.nutrients.kcal
    d.protein += e.nutrients.protein
    byDay.set(e.date, d)
  }
  const days = [...byDay.values()]
  const weights = (a: string, b: string) => p.bodyweights.filter((x) => x.date >= a && x.date < b).map((x) => x.weight)

  const s: Omit<WeekSummary, 'tip'> = {
    start,
    end,
    sessions: week.length,
    goal: p.settings.weeklyWorkoutGoal,
    durationMs: week.reduce((t, w) => t + workoutTotals(w, p.exercises).durationMs, 0),
    volume: volumeBetween(p.workouts, p.exercises, from, to),
    prevVolume: volumeBetween(p.workouts, p.exercises, prevFrom, from),
    records: recentPRs(p.workouts, p.exercises, from).filter((r) => r.date < to),
    muscles: muscleSets(p.workouts, p.exercises, from, to),
    nutrition: {
      days: days.length,
      kcal: avg(days.map((d) => d.kcal)) ?? 0,
      protein: avg(days.map((d) => d.protein)) ?? 0,
      kcalGoal: p.settings.goals.kcal,
      proteinGoal: p.settings.goals.protein,
    },
    weight: { avg: avg(weights(startIso, endIso)), prevAvg: avg(weights(toISODate(new Date(prevFrom)), startIso)) },
  }
  return { ...s, tip: weeklyTip(s) }
}

/** Un seul point à améliorer, le plus utile, déduit des chiffres de la semaine. */
export function weeklyTip(s: Omit<WeekSummary, 'tip'>): string {
  if (s.sessions === 0) return 'Aucune séance cette semaine : bloque deux créneaux dans ton agenda dès lundi, même courts.'
  if (s.sessions < s.goal)
    return `${s.sessions} séance${s.sessions > 1 ? 's' : ''} sur ${s.goal} prévues : vise des séances plus courtes mais plus régulières pour tenir ton objectif.`
  const { days, protein, proteinGoal } = s.nutrition
  if (days >= 3 && proteinGoal > 0 && protein < proteinGoal * 0.9)
    return `Protéines : ${Math.round(protein)} g par jour en moyenne pour ${proteinGoal} g visés. Ajoute une source à chaque repas (skyr, œufs, viande, légumineuses).`
  const behind = MAIN.map((m) => ({ m, n: s.muscles.get(m) ?? 0, lo: weeklyTarget(m)[0] }))
    .filter((x) => x.n < x.lo)
    .sort((a, b) => a.n / a.lo - b.n / b.lo)[0]
  if (behind)
    return `${MUSCLE_LABELS[behind.m]} : ${formatNumber(behind.n)} série${behind.n > 1 ? 's' : ''} cette semaine pour ${behind.lo} conseillées. Ajoute 2 à 3 séries la semaine prochaine.`
  if (days < 4) return `Repas notés ${days} jour${days > 1 ? 's' : ''} sur 7 : vise au moins 5 jours pour que tes moyennes et l'ajustement des calories soient fiables.`
  return 'Semaine complète : objectif de séances tenu, muscles bien répartis et nutrition suivie. Continue comme ça.'
}

/** « du 19 au 25 oct. » */
export function weekLabel(start: Date): string {
  const last = fromISODate(addDays(toISODate(start), 6))
  const d = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' })
  const dm = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
  return start.getMonth() === last.getMonth() ? `du ${d.format(start)} au ${dm.format(last)}` : `du ${dm.format(start)} au ${dm.format(last)}`
}
