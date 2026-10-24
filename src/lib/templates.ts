// Programmes prêts à l'emploi, importables en un clic dans « Mes routines ».
import type { RoutineExercise, SetData } from './types'
import { uid } from './utils'

type Line = [exerciseId: string, sets: number, reps: number, restSec?: number]

export interface ProgramTemplate {
  id: string
  name: string
  level: string
  daysPerWeek: number
  description: string
  routines: { name: string; lines: Line[] }[]
}

export const PROGRAMS: ProgramTemplate[] = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    level: 'Intermédiaire',
    daysPerWeek: 6,
    description: 'Le grand classique : chaque groupe musculaire 2× par semaine en 3 séances alternées.',
    routines: [
      {
        name: 'Push — Pecs, épaules, triceps',
        lines: [
          ['bench-press', 4, 6, 180],
          ['db-incline-press', 3, 10, 120],
          ['overhead-press', 3, 8, 150],
          ['cable-lateral-raise', 3, 15, 60],
          ['rope-pushdown', 3, 12, 60],
          ['overhead-triceps-ext', 3, 12, 60],
        ],
      },
      {
        name: 'Pull — Dos, biceps',
        lines: [
          ['pull-up', 4, 8, 150],
          ['barbell-row', 3, 8, 150],
          ['seated-cable-row', 3, 12, 90],
          ['face-pull', 3, 15, 60],
          ['incline-db-curl', 3, 12, 60],
          ['hammer-curl', 3, 12, 60],
        ],
      },
      {
        name: 'Legs — Jambes',
        lines: [
          ['back-squat', 4, 6, 180],
          ['romanian-deadlift', 3, 10, 150],
          ['leg-press', 3, 12, 120],
          ['lying-leg-curl', 3, 12, 60],
          ['leg-extension', 3, 15, 60],
          ['standing-calf-raise', 4, 12, 60],
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Haut / Bas',
    level: 'Débutant → intermédiaire',
    daysPerWeek: 4,
    description: '4 séances par semaine, idéal pour progresser en force et en masse.',
    routines: [
      {
        name: 'Haut du corps A',
        lines: [
          ['bench-press', 4, 6, 180],
          ['barbell-row', 4, 8, 150],
          ['db-shoulder-press', 3, 10, 90],
          ['lat-pulldown', 3, 10, 90],
          ['ez-curl', 2, 12, 60],
          ['triceps-pushdown', 2, 12, 60],
        ],
      },
      {
        name: 'Bas du corps A',
        lines: [
          ['back-squat', 4, 6, 180],
          ['romanian-deadlift', 3, 8, 150],
          ['bulgarian-split-squat', 3, 10, 90],
          ['seated-leg-curl', 3, 12, 60],
          ['standing-calf-raise', 3, 12, 60],
          ['hanging-leg-raise', 3, 12, 60],
        ],
      },
      {
        name: 'Haut du corps B',
        lines: [
          ['overhead-press', 4, 6, 180],
          ['pull-up', 4, 8, 150],
          ['db-incline-press', 3, 10, 90],
          ['db-row', 3, 10, 90],
          ['lateral-raise', 3, 15, 60],
          ['hammer-curl', 2, 12, 60],
        ],
      },
      {
        name: 'Bas du corps B',
        lines: [
          ['deadlift', 3, 5, 210],
          ['front-squat', 3, 8, 150],
          ['hip-thrust', 3, 10, 90],
          ['leg-extension', 3, 12, 60],
          ['seated-calf-raise', 3, 15, 60],
          ['plank', 3, 0, 60],
        ],
      },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body 3×',
    level: 'Débutant',
    daysPerWeek: 3,
    description: 'Tout le corps à chaque séance, 3 fois par semaine. Parfait pour démarrer.',
    routines: [
      {
        name: 'Full Body A',
        lines: [
          ['back-squat', 3, 8, 150],
          ['bench-press', 3, 8, 150],
          ['barbell-row', 3, 8, 120],
          ['lateral-raise', 2, 15, 60],
          ['plank', 3, 0, 60],
        ],
      },
      {
        name: 'Full Body B',
        lines: [
          ['deadlift', 3, 5, 180],
          ['overhead-press', 3, 8, 150],
          ['lat-pulldown', 3, 10, 90],
          ['goblet-squat', 2, 12, 90],
          ['db-curl', 2, 12, 60],
        ],
      },
    ],
  },
]

export function templateToExercises(lines: Line[], kindOf: (id: string) => string | undefined): RoutineExercise[] {
  return lines.map(([exerciseId, sets, reps, restSec = 90]) => {
    const kind = kindOf(exerciseId)
    const set: SetData = kind === 'duration' ? { type: 'normal', duration: 45 } : { type: 'normal', reps }
    return { uid: uid(), exerciseId, restSec, sets: Array.from({ length: sets }, () => ({ ...set })) }
  })
}
