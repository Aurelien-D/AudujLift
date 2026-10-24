import { Minimize2 } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useActiveWorkout, useNow } from '../lib/hooks'
import { restTimer, useRestTimer } from '../lib/restTimer'
import { cn, formatClock } from '../lib/utils'

/** Anneau de progression du repos (doré, se vide au fil du temps). */
function RestRing({ pct, size, stroke, children }: { pct: number; size: number; stroke: number; children: React.ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#22252D" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#D6B56E"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

function Adjust({ big }: { big?: boolean }) {
  const cls = cn('press rounded-xl border border-line bg-raised font-semibold text-ivory active:bg-line', big ? 'h-14 flex-1 text-base' : 'h-10 px-3 text-sm')
  return (
    <>
      <button aria-label="Retirer 15 secondes" onClick={() => restTimer.add(-15)} className={cls}>
        −15 s
      </button>
      <button aria-label="Ajouter 15 secondes" onClick={() => restTimer.add(15)} className={cls}>
        +15 s
      </button>
      <button
        onClick={() => restTimer.stop()}
        className={cn('press rounded-xl bg-gold font-semibold text-ink active:bg-gold-pale', big ? 'h-14 flex-[1.4] text-base' : 'h-10 px-3.5 text-sm')}
      >
        {big ? 'Fin du repos' : 'Passer'}
      </button>
    </>
  )
}

/** Minuteur de repos : bandeau compact partout, vue plein écran centrée sur demande. */
export function RestTimerBar({ raised }: { raised: boolean }) {
  const { endAt, total, next } = useRestTimer()
  const now = useNow(250)
  const active = useActiveWorkout()
  const [expanded, setExpanded] = useState(false)
  // Chaque repos démarre en bandeau : la vue plein écran ne doit pas masquer la séance au repos suivant
  if (!endAt && expanded) setExpanded(false)
  if (!endAt) return null
  const remaining = Math.max(0, (endAt - now) / 1000)
  const pct = total ? Math.min(1, remaining / total) : 0

  if (expanded)
    return createPortal(
      <div className="animate-fade fixed inset-0 z-[60] flex flex-col bg-ink/97 backdrop-blur-xl" role="dialog" aria-label="Repos">
        <div className="flex justify-end px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <button aria-label="Réduire" onClick={() => setExpanded(false)} className="press flex size-11 items-center justify-center rounded-full text-silver active:bg-raised">
            <Minimize2 size={22} />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
          <div className="label">Repos</div>
          <RestRing pct={pct} size={260} stroke={6}>
            <div className="font-display text-7xl font-semibold tracking-tight text-ivory" aria-live="off">
              {formatClock(remaining)}
            </div>
            <div className="mt-1 text-sm text-silver">sur {formatClock(total)}</div>
          </RestRing>
          {next && (
            <div className="text-center">
              <div className="label">Ensuite</div>
              <div className="mt-1 text-lg font-medium text-ivory">{next}</div>
            </div>
          )}
        </div>
        <div className="pb-safe mx-auto flex w-full max-w-md gap-2 px-4 pb-6">
          <Adjust big />
        </div>
      </div>,
      document.body,
    )

  return (
    <div
      className={cn(
        'animate-rise fixed inset-x-3 z-40 mx-auto max-w-[calc(36rem-1.5rem)] rounded-2xl border border-line bg-surface/95 shadow-2xl shadow-black/60 backdrop-blur-xl',
        raised
          ? active
            ? 'bottom-[calc(env(safe-area-inset-bottom)+136px)]'
            : 'bottom-[calc(env(safe-area-inset-bottom)+68px)]'
          : 'bottom-[calc(env(safe-area-inset-bottom)+12px)]',
      )}
    >
      <div className="flex items-center gap-3 px-3 pt-2.5 pb-2">
        <button aria-label="Agrandir le minuteur" onClick={() => setExpanded(true)} className="press flex min-w-0 flex-1 items-center gap-3 text-left">
          <RestRing pct={pct} size={40} stroke={3.5}>
            <span className="size-1.5 rounded-full bg-gold" />
          </RestRing>
          <div className="font-display text-2xl leading-none font-semibold text-ivory">{formatClock(remaining)}</div>
        </button>
        <div className="flex shrink-0 gap-1.5">
          <Adjust />
        </div>
      </div>
      <button onClick={() => setExpanded(true)} className="block w-full truncate border-t border-line/60 px-3.5 py-1.5 text-left text-xs text-silver">
        {next ? (
          <>
            Ensuite · <span className="text-ivory-dim">{next}</span>
          </>
        ) : (
          'Repos en cours'
        )}
      </button>
    </div>
  )
}
