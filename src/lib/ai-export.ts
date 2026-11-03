// Export des séances en texte (Markdown) à coller dans Claude, ChatGPT ou tout autre assistant pour analyse.
import { MUSCLE_LABELS } from './exercises-data'
import { muscleSets } from './insights'
import { e1rm, workoutTotals } from './stats'
import type { Exercise, Goal, MuscleGroup, Sex, Workout, WorkoutSet } from './types'
import { formatDuration, formatNumber } from './utils'

export interface ExportProfile {
  sex: Sex
  age?: number
  heightCm?: number
  bodyweight?: number
  goal: Goal
  weeklyGoal: number
}

export const AI_PROMPT =
  'Analyse ces séances de musculation comme un coach expérimenté : progression (charges, répétitions, volume, 1RM estimé), équilibre entre groupes musculaires et volume hebdomadaire, intensité (RPE) et récupération. Signale ce qui stagne ou manque, puis propose des ajustements concrets et chiffrés pour les 4 prochaines semaines. Réponds en français.'

const GOAL_TEXT: Record<Goal, string> = { cut: 'sèche (perte de gras)', maintain: 'maintien', bulk: 'prise de masse' }

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** Une série en notation compacte : « 80×8 », « PDC+10×8 », « 60 s », « 5 km en 25 min », avec RPE et type. */
export function formatSetForAi(s: WorkoutSet, kind: Exercise['kind']): string {
  let out: string
  if (kind === 'duration') out = `${s.weight ? `+${formatNumber(s.weight)} kg ` : ''}${s.duration ?? 0} s`
  else if (kind === 'cardio')
    out = [s.distance ? `${formatNumber(s.distance, 2)} km` : '', s.duration ? `${Math.round(s.duration / 60)} min` : ''].filter(Boolean).join(' en ') || '—'
  else if (kind === 'bodyweight') out = `${s.weight ? `PDC+${formatNumber(s.weight)}` : 'PDC'}×${s.reps ?? 0}`
  else out = `${formatNumber(s.weight ?? 0)}×${s.reps ?? 0}`
  if (s.rpe != null) out += ` @RPE${formatNumber(s.rpe)}`
  if (s.type === 'drop') out += ' (dégressive)'
  if (s.type === 'failure') out += ' (échec)'
  return out
}

/** Regroupe les séries identiques qui se suivent : « 85×6, 85×6, 85×6 » → « 85×6 (×3) ». */
function compact(labels: string[]): string {
  const out: string[] = []
  for (let i = 0; i < labels.length;) {
    let j = i + 1
    while (j < labels.length && labels[j] === labels[i]) j++
    out.push(j - i > 1 ? `${labels[i]} (×${j - i})` : labels[i])
    i = j
  }
  return out.join(', ')
}

function profileLine(p: ExportProfile): string {
  const parts = [
    p.sex === 'female' ? 'femme' : 'homme',
    p.age ? `${p.age} ans` : '',
    p.heightCm ? `${formatNumber(p.heightCm / 100, 2)} m` : '',
    p.bodyweight ? `${formatNumber(p.bodyweight)} kg` : '',
  ]
  return `Profil : ${parts.filter(Boolean).join(', ')}. Objectif : ${GOAL_TEXT[p.goal]}, ${p.weeklyGoal} séance${p.weeklyGoal > 1 ? 's' : ''} par semaine visées.`
}

export function workoutsToMarkdown(opts: {
  workouts: Workout[]
  exMap: Map<string, Exercise>
  profile: ExportProfile
  periodLabel: string
  /** Durée de la période choisie (moyennes par semaine) ; à défaut, de la première séance à aujourd'hui */
  periodDays?: number
  withPrompt?: boolean
  now?: number
}): string {
  const { exMap, profile } = opts
  const list = opts.workouts.filter((w) => w.status === 'done').sort((a, b) => a.startedAt - b.startedAt)
  const lines: string[] = ['# Mes séances de musculation (export AudujLift)', '']
  if (opts.withPrompt !== false) lines.push(AI_PROMPT, '')
  lines.push(profileLine(profile))
  lines.push(`Période : ${opts.periodLabel} — ${list.length} séance${list.length > 1 ? 's' : ''}.`)
  lines.push('Notation : charge en kg × répétitions ; PDC = poids du corps (+ lest) ; @RPE = effort ressenti sur 10 ; 1RM est. = 1RM estimé (Epley) de la meilleure série.')

  for (const w of list) {
    const t = workoutTotals(w, exMap)
    lines.push('', `## ${dateFmt.format(new Date(w.startedAt))} — ${w.name} (${formatDuration(t.durationMs)}, ${t.sets} séries, volume ${formatNumber(t.volume, 0)} kg)`)
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId)
      const kind = ex?.kind ?? 'weight_reps'
      const done = we.sets.filter((s) => s.done !== false)
      if (!done.length) continue
      const warm = done.filter((s) => s.type === 'warmup')
      const work = done.filter((s) => s.type !== 'warmup')
      const best =
        kind === 'weight_reps' || kind === 'bodyweight'
          ? Math.max(0, ...work.map((s) => e1rm((kind === 'bodyweight' ? (w.bodyweight ?? profile.bodyweight ?? 0) : 0) + (s.weight ?? 0), s.reps ?? 0)))
          : 0
      const muscle = ex ? MUSCLE_LABELS[ex.muscle].toLowerCase() : ''
      let line = `- ${ex?.name ?? 'Exercice supprimé'}${muscle ? ` [${muscle}]` : ''} : ${compact(work.map((s) => formatSetForAi(s, kind))) || '—'}`
      if (warm.length) line += ` ; échauffement ${compact(warm.map((s) => formatSetForAi(s, kind)))}`
      if (best > 0) line += ` — 1RM est. ${formatNumber(best, 0)} kg`
      if (we.notes) line += ` — note : ${we.notes.replace(/\s+/g, ' ').trim()}`
      lines.push(line)
    }
    if (w.notes?.trim()) lines.push(`Note de séance : ${w.notes.replace(/\s+/g, ' ').trim()}`)
  }

  if (list.length > 1) {
    const from = list[0].startedAt
    const to = list[list.length - 1].startedAt + 1
    const days = opts.periodDays ?? ((opts.now ?? Date.now()) - from) / 86_400_000
    const weeks = Math.max(1, days / 7)
    const totalVolume = list.reduce((n, w) => n + workoutTotals(w, exMap).volume, 0)
    const sets = [...muscleSets(list, exMap, from, to)].sort((a, b) => b[1] - a[1])
    lines.push('', '## Résumé de la période')
    lines.push(
      `- ${formatNumber(list.length / weeks, 1)} séance(s) par semaine en moyenne sur ${formatNumber(weeks, 0)} semaine(s), volume total ${formatNumber(totalVolume, 0)} kg.`,
    )
    if (sets.length)
      lines.push(
        `- Séries de travail par semaine et par groupe musculaire (muscles secondaires comptés pour moitié) : ${sets
          .map(([m, n]) => `${MUSCLE_LABELS[m as MuscleGroup].toLowerCase()} ${formatNumber(n / weeks, 1)}`)
          .join(', ')}.`,
      )
  }
  return lines.join('\n')
}

/** Liens qui ouvrent une nouvelle conversation pré-remplie. Les accents triplent la longueur une fois encodés :
 *  au-delà d'une adresse raisonnable, le lien n'ouvre qu'une consigne et le texte (copié) est à coller. */
export const AI_URL_MAX = 7000
export function assistantUrl(target: 'claude' | 'chatgpt', text: string): { url: string; prefilled: boolean } {
  const base = target === 'claude' ? 'https://claude.ai/new?q=' : 'https://chatgpt.com/?q='
  const full = encodeURIComponent(text)
  const prefilled = full.length <= AI_URL_MAX
  return { url: base + (prefilled ? full : encodeURIComponent(`${AI_PROMPT}\n\nJe colle ci-dessous l'export de mes séances :\n\n`)), prefilled }
}
