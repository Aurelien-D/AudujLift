import { fromISODate } from './utils'

/** Énergie stockée dans 1 kg de masse corporelle (approximation usuelle). */
export const KCAL_PER_KG = 7700

export interface TdeeEstimate {
  /** Dépense énergétique réelle estimée (kcal/j) */
  tdee: number
  /** Apport moyen des jours suivis (kcal/j) */
  avgIntake: number
  /** Tendance du poids (kg/semaine), négative = perte */
  kgPerWeek: number
  loggedDays: number
  weighIns: number
}

/** Pente (unité/jour) d'une régression linéaire simple. */
export function slopePerDay(points: { date: string; value: number }[]): number {
  const xs = points.map((p) => fromISODate(p.date).getTime() / 86400000)
  const ys = points.map((p) => p.value)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  return den ? num / den : 0
}

/**
 * Dépense réelle à la manière de MacroFactor : apport moyen − variation d'énergie stockée.
 * Si le poids est stable avec 2 300 kcal/j, la dépense est ~2 300 kcal. S'il baisse de 0,5 kg/sem,
 * la dépense est supérieure à l'apport de 0,5 × 7 700 / 7 ≈ 550 kcal/j.
 * Exige au moins 10 jours de suivi complets et 4 pesées sur 10 jours ou plus, sinon renvoie undefined.
 */
export function estimateTdee(
  weights: { date: string; weight: number }[],
  intake: { date: string; kcal: number }[],
  opts: { from: string; to: string; minKcal?: number } = { from: '', to: '9999' },
): TdeeEstimate | undefined {
  const minKcal = opts.minKcal ?? 800
  // Jours trop bas = journal probablement incomplet : on les écarte
  const days = intake.filter((d) => d.date >= opts.from && d.date <= opts.to && d.kcal >= minKcal)
  const w = weights.filter((x) => x.date >= opts.from && x.date <= opts.to).sort((a, b) => a.date.localeCompare(b.date))
  if (days.length < 10 || w.length < 4) return undefined
  const span = (fromISODate(w[w.length - 1].date).getTime() - fromISODate(w[0].date).getTime()) / 86400000
  if (span < 10) return undefined
  const avgIntake = days.reduce((a, d) => a + d.kcal, 0) / days.length
  const slope = slopePerDay(w.map((x) => ({ date: x.date, value: x.weight })))
  const tdee = avgIntake - slope * KCAL_PER_KG
  return { tdee: Math.round(tdee), avgIntake: Math.round(avgIntake), kgPerWeek: slope * 7, loggedDays: days.length, weighIns: w.length }
}
