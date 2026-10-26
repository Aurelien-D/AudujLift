import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, db, getSettings } from './db'
import { ageFromBirthYear, type BodyProfile } from './stats'
import type { Exercise, Settings } from './types'
import { fromISODate } from './utils'

export function useSettings(): Settings {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS)
}

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useExercises()
  return useMemo(() => new Map((list ?? []).map((e) => [e.id, e])), [list])
}

export function useDoneWorkouts() {
  return useLiveQuery(() => db.workouts.where('status').equals('done').reverse().sortBy('startedAt'), [])
}

export function useActiveWorkout() {
  return useLiveQuery(() => db.workouts.where('status').equals('active').first(), [])
}

export function useLatestBodyweight(): number | undefined {
  return useLiveQuery(async () => (await db.bodyweights.orderBy('date').last())?.weight, [])
}

/** Gabarit utilisé pour les rangs (sexe, dernière pesée, taille, âge) ; null sans pesée, undefined pendant le chargement. */
export function useRankBody(): BodyProfile | null | undefined {
  const settings = useSettings()
  const bw = useLiveQuery(async () => (await db.bodyweights.orderBy('date').last())?.weight ?? null, [])
  return useMemo(
    () => (bw === undefined ? undefined : bw ? { sex: settings.sex, bodyweight: bw, heightCm: settings.heightCm, age: ageFromBirthYear(settings.birthYear) } : null),
    [bw, settings.sex, settings.heightCm, settings.birthYear],
  )
}

/** Jour d'entraînement ? Choix manuel s'il existe, sinon vrai si une séance a eu lieu ce jour-là. */
export function useDayType(date: string): { training: boolean; manual: boolean } {
  const start = fromISODate(date).getTime()
  const count = useLiveQuery(
    () =>
      db.workouts
        .where('startedAt')
        .between(start, start + 86400000)
        .count(),
    [start],
    0,
  )
  const day = useLiveQuery(() => db.days.get(date), [date])
  if (day?.dayType) return { training: day.dayType === 'training', manual: true }
  return { training: count > 0, manual: false }
}

/** Re-render chaque seconde (chronos). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
