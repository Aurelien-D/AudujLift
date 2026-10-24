import { ChevronUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useActiveWorkout, useNow } from '../lib/hooks'
import { formatClock } from '../lib/utils'
import { SolarSigil } from './SolarSigil'

/** Bandeau « séance en cours » visible partout tant qu'une séance est ouverte. */
export function ActiveWorkoutBar() {
  const workout = useActiveWorkout()
  const now = useNow()
  const navigate = useNavigate()
  if (!workout) return null
  const done = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
  const total = workout.exercises.reduce((n, e) => n + e.sets.length, 0)
  return (
    <button
      onClick={() => navigate('/workout/active')}
      className="press animate-rise fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+66px)] z-40 mx-auto flex max-w-[calc(36rem-1.5rem)] items-center gap-3 overflow-hidden rounded-2xl border border-gold/30 bg-raised px-4 py-3 text-left shadow-xl shadow-black/50"
    >
      <SolarSigil size={22} className="text-gold" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ivory">{workout.name}</div>
        <div className="text-xs text-silver">
          <span className="text-gold">{formatClock((now - workout.startedAt) / 1000)}</span> · {done}/{total} série{total > 1 ? 's' : ''}
        </div>
      </div>
      <span className="text-xs font-medium text-gold">Reprendre</span>
      <ChevronUp size={18} className="text-gold" />
      {total > 0 && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gold/80 transition-[width]" style={{ width: `${(done / total) * 100}%` }} />}
    </button>
  )
}
