import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, db, getSettings } from './db'
import type { Exercise, Settings } from './types'

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

/** Re-render chaque seconde (chronos). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
