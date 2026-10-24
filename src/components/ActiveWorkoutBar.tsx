import { ChevronUp, Dumbbell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useActiveWorkout, useNow } from '../lib/hooks'
import { formatClock } from '../lib/utils'

/** Bandeau « séance en cours » visible partout tant qu'une séance est ouverte. */
export function ActiveWorkoutBar() {
  const workout = useActiveWorkout()
  const now = useNow()
  const navigate = useNavigate()
  if (!workout) return null
  const done = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
  return (
    <button
      onClick={() => navigate('/workout/active')}
      className="animate-pop fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-40 mx-auto flex max-w-[calc(36rem-1.5rem)] items-center gap-3 rounded-2xl bg-gradient-accent px-4 py-3 text-left text-zinc-950 shadow-xl shadow-black/40"
    >
      <Dumbbell size={20} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{workout.name}</div>
        <div className="text-xs font-medium opacity-80">
          {formatClock((now - workout.startedAt) / 1000)} · {done} série{done > 1 ? 's' : ''}
        </div>
      </div>
      <ChevronUp size={20} />
    </button>
  )
}
