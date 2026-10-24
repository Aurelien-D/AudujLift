import { Timer } from 'lucide-react'
import { useActiveWorkout, useNow } from '../lib/hooks'
import { restTimer, useRestTimer } from '../lib/restTimer'
import { cn, formatClock } from '../lib/utils'

/** Minuteur de repos flottant, avec ±15 s et « passer ». */
export function RestTimerBar({ raised }: { raised: boolean }) {
  const { endAt, total } = useRestTimer()
  const now = useNow(250)
  const active = useActiveWorkout()
  if (!endAt) return null
  const remaining = Math.max(0, (endAt - now) / 1000)
  const pct = total ? remaining / total : 0
  return (
    <div
      className={cn(
        'animate-pop fixed inset-x-3 z-40 mx-auto max-w-[calc(36rem-1.5rem)] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/95 shadow-2xl shadow-black/60 backdrop-blur-xl',
        raised
          ? active
            ? 'bottom-[calc(env(safe-area-inset-bottom)+132px)]'
            : 'bottom-[calc(env(safe-area-inset-bottom)+68px)]'
          : 'bottom-[calc(env(safe-area-inset-bottom)+12px)]',
      )}
    >
      <div className="absolute inset-y-0 left-0 bg-lime-400/10 transition-[width] duration-200" style={{ width: `${pct * 100}%` }} />
      <div className="relative flex items-center gap-2 px-3 py-2.5">
        <Timer size={20} className="text-lime-400" />
        <div className="w-16 text-2xl font-bold tabular-nums">{formatClock(remaining)}</div>
        <div className="flex-1" />
        <button onClick={() => restTimer.add(-15)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold active:bg-zinc-700">
          −15
        </button>
        <button onClick={() => restTimer.add(15)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold active:bg-zinc-700">
          +15
        </button>
        <button onClick={() => restTimer.stop()} className="rounded-lg bg-lime-400 px-3 py-2 text-sm font-bold text-zinc-950 active:brightness-90">
          Passer
        </button>
      </div>
    </div>
  )
}
