import { db, getSettings } from './db'
import { progressedWeight } from './progression'
import { exerciseHistory } from './stats'
import type { Exercise, Routine, RoutineExercise, SetData, Workout, WorkoutExercise, WorkoutSet } from './types'
import { uid } from './utils'

export const SET_TYPE_LABELS: Record<SetData['type'], { short: string; label: string; color: string }> = {
  warmup: { short: 'É', label: 'Échauffement', color: 'text-warn' },
  normal: { short: '', label: 'Normale', color: 'text-ivory-dim' },
  drop: { short: 'D', label: 'Dégressive (drop set)', color: 'text-amethyst-light' },
  failure: { short: 'F', label: "Jusqu'à l'échec", color: 'text-danger' },
}

export async function getActiveWorkout() {
  return db.workouts.where('status').equals('active').first()
}

async function latestBodyweight() {
  const last = await db.bodyweights.orderBy('date').last()
  return last?.weight
}

/**
 * Séries préremplies avec les valeurs de la dernière séance pour cet exercice,
 * avec +2,5 kg si toutes les reps visées avaient été réussies.
 */
async function prefillFromHistory(exerciseId: string, template: SetData[]): Promise<{ sets: WorkoutSet[]; progression?: { from: number; to: number }; deload?: number }> {
  const ex = await db.exercises.get(exerciseId)
  const settings = await getSettings()
  const done = await db.workouts.where('status').equals('done').reverse().sortBy('startedAt')
  const last = ex ? exerciseHistory(ex, done.slice(0, 60))[0] : undefined
  const plan = settings.deloads?.[exerciseId]
  const deload = plan && plan.until > Date.now() ? plan.weight : undefined
  const progression = !deload && settings.autoProgression && ex?.kind === 'weight_reps' ? progressedWeight(template, last?.sets) : undefined
  const sets = template.map((s, i) => {
    const prev = last?.sets.filter((p) => p.type === s.type)[template.slice(0, i).filter((t) => t.type === s.type).length]
    let weight = s.weight ?? prev?.weight
    if (progression && s.type === 'normal' && weight === progression.from) weight = progression.to
    if (deload != null && s.type !== 'warmup' && weight != null && weight > deload) weight = deload
    return {
      type: s.type,
      weight,
      reps: s.reps ?? prev?.reps,
      duration: s.duration ?? prev?.duration,
      distance: s.distance ?? prev?.distance,
      done: false,
    }
  })
  return { sets, progression, deload }
}

export async function startWorkout(routine?: Routine): Promise<string> {
  const existing = await getActiveWorkout()
  if (existing) return existing.id
  const exercises: WorkoutExercise[] = []
  for (const re of routine?.exercises ?? []) {
    const { sets, progression, deload } = await prefillFromHistory(re.exerciseId, re.sets.length ? re.sets : [{ type: 'normal' }])
    exercises.push({ uid: uid(), exerciseId: re.exerciseId, restSec: re.restSec, notes: re.notes, supersetId: re.supersetId, sets, progression, deload })
  }
  const now = new Date()
  const hour = now.getHours()
  const fallbackName = hour < 11 ? 'Séance du matin' : hour < 17 ? "Séance de l'après-midi" : 'Séance du soir'
  const w: Workout = {
    id: uid(),
    name: routine?.name ?? fallbackName,
    routineId: routine?.id,
    status: 'active',
    startedAt: Date.now(),
    exercises,
    bodyweight: await latestBodyweight(),
  }
  await db.workouts.add(w)
  if (routine) await db.routines.update(routine.id, { lastUsedAt: Date.now() })
  return w.id
}

export async function newWorkoutExercise(exercise: Exercise): Promise<WorkoutExercise> {
  const settings = await getSettings()
  const { sets, deload } = await prefillFromHistory(exercise.id, [{ type: 'normal' }, { type: 'normal' }, { type: 'normal' }])
  return { uid: uid(), exerciseId: exercise.id, restSec: settings.defaultRestSec, sets, deload }
}

export function newRoutineExercise(exercise: Exercise, restSec: number): RoutineExercise {
  const base: SetData = exercise.kind === 'duration' ? { type: 'normal', duration: 60 } : exercise.kind === 'cardio' ? { type: 'normal' } : { type: 'normal', reps: 10 }
  return {
    uid: uid(),
    exerciseId: exercise.id,
    restSec: exercise.kind === 'cardio' ? 0 : restSec,
    sets: exercise.kind === 'cardio' ? [base] : [{ ...base }, { ...base }, { ...base }],
  }
}

/** Convertit une séance terminée en routine (séries réalisées comme cibles). */
export function workoutToRoutineExercises(w: Workout): RoutineExercise[] {
  return w.exercises.map((e) => ({
    uid: uid(),
    exerciseId: e.exerciseId,
    restSec: e.restSec,
    notes: e.notes,
    supersetId: e.supersetId,
    sets: (e.sets.some((s) => s.done) ? e.sets.filter((s) => s.done) : e.sets).map(({ type, weight, reps, duration, distance }) => ({ type, weight, reps, duration, distance })),
  }))
}

/** Supprime les séries non validées et les exercices vides, puis clôt la séance. */
export async function finishWorkout(w: Workout): Promise<Workout> {
  const exercises = w.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length)
  const done: Workout = { ...w, exercises, status: 'done', endedAt: Date.now() }
  await db.workouts.put(done)
  return done
}
