import { useState } from 'react'
import { MUSCLE_LABELS } from '../lib/exercises-data'
import { muscleStatus, weeklyTarget, type MuscleStatus } from '../lib/insights'
import type { MuscleGroup } from '../lib/types'
import { cn, formatNumber } from '../lib/utils'

// Silhouette géométrique (viewBox 120 × 230), zones dessinées côté gauche puis reflétées.
type Zone = { m: MuscleGroup; d: string; mirror?: boolean }

const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${120 - Number(x)},${y}`)

const FRONT: Zone[] = [
  { m: 'epaules', d: 'M31,45 L41,38 L47,42 L45,55 L35,60 L29,54 Z', mirror: true },
  { m: 'pectoraux', d: 'M48,42 L59,44 L59,60 L50,63 L45,57 L47,46 Z', mirror: true },
  { m: 'biceps', d: 'M29,59 L36,61 L36,80 L31,85 L26,79 L27,65 Z', mirror: true },
  { m: 'avant-bras', d: 'M25,85 L31,87 L30,108 L25,113 L20,108 L21,93 Z', mirror: true },
  { m: 'abdos', d: 'M50,65 L70,65 L69,101 L60,106 L51,101 Z' },
  { m: 'quadriceps', d: 'M44,109 L55,111 L55,150 L50,157 L44,151 L41,129 Z', mirror: true },
  { m: 'adducteurs', d: 'M56,112 L60,113 L60,139 L56,146 Z', mirror: true },
  { m: 'mollets', d: 'M45,164 L52,162 L52,196 L48,204 L44,196 L43,177 Z', mirror: true },
]

const BACK: Zone[] = [
  { m: 'trapezes', d: 'M50,31 L70,31 L77,41 L60,51 L43,41 Z' },
  { m: 'epaules', d: 'M31,45 L41,38 L45,43 L44,55 L35,60 L29,54 Z', mirror: true },
  { m: 'dos', d: 'M46,46 L59,52 L59,81 L52,85 L45,67 Z', mirror: true },
  { m: 'triceps', d: 'M29,59 L36,61 L36,80 L31,85 L26,79 L27,65 Z', mirror: true },
  { m: 'avant-bras', d: 'M25,85 L31,87 L30,108 L25,113 L20,108 L21,93 Z', mirror: true },
  { m: 'lombaires', d: 'M52,86 L68,86 L68,101 L52,101 Z' },
  { m: 'fessiers', d: 'M45,103 L59,105 L59,125 L50,127 L44,119 Z', mirror: true },
  { m: 'ischios', d: 'M44,129 L58,129 L57,155 L50,159 L44,151 Z', mirror: true },
  { m: 'mollets', d: 'M44,163 L53,161 L54,185 L49,201 L43,187 Z', mirror: true },
]

const FILL: Record<MuscleStatus, string> = {
  none: '#22252D',
  low: 'rgba(214,181,110,0.35)',
  optimal: '#D6B56E',
  high: '#A58AD0',
}

function Figure({
  zones,
  sets,
  selected,
  onSelect,
  label,
}: {
  zones: Zone[]
  sets: Map<MuscleGroup, number>
  selected?: MuscleGroup
  onSelect: (m: MuscleGroup) => void
  label: string
}) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 120 230" className="h-64 w-auto" role="img" aria-label={`Muscles, vue de ${label}`}>
        {/* Contour neutre : tête, cou, mains, pieds */}
        <circle cx="60" cy="17" r="10" fill="none" stroke="#2D313A" strokeWidth="1.2" />
        <path d="M55,28 L65,28 L66,35 L54,35 Z" fill="#1C1F26" />
        <path d="M20,114 L26,116 L24,124 L18,122 Z M100,114 L94,116 L96,124 L102,122 Z" fill="#1C1F26" />
        <path d="M43,206 L50,206 L51,213 L41,213 Z M77,206 L70,206 L69,213 L79,213 Z" fill="#1C1F26" />
        {zones.flatMap((z) =>
          (z.mirror ? [z.d, mirror(z.d)] : [z.d]).map((d, i) => {
            const n = sets.get(z.m) ?? 0
            return (
              <path
                key={`${z.m}-${i}`}
                d={d}
                fill={FILL[muscleStatus(z.m, n)]}
                stroke={selected === z.m ? '#E8D3A1' : '#0B0D12'}
                strokeWidth={selected === z.m ? 1.6 : 1}
                strokeLinejoin="round"
                className="cursor-pointer transition-[fill] duration-300"
                onClick={() => onSelect(z.m)}
              >
                <title>{`${MUSCLE_LABELS[z.m]} : ${formatNumber(n)} séries`}</title>
              </path>
            )
          }),
        )}
      </svg>
      <figcaption className="label mt-1">{label}</figcaption>
    </figure>
  )
}

/** Carte des muscles : séries de la semaine comparées à la fourchette conseillée. */
export function MuscleMap({ sets }: { sets: Map<MuscleGroup, number> }) {
  const [selected, setSelected] = useState<MuscleGroup>()
  const sel = selected ?? [...sets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const n = sel ? (sets.get(sel) ?? 0) : 0
  const status = sel ? muscleStatus(sel, n) : 'none'
  const [lo, hi] = sel ? weeklyTarget(sel) : [10, 20]
  return (
    <div>
      <div className="flex justify-center gap-2">
        <Figure zones={FRONT} sets={sets} selected={sel} onSelect={setSelected} label="Face" />
        <Figure zones={BACK} sets={sets} selected={sel} onSelect={setSelected} label="Dos" />
      </div>
      {sel && (
        <div className="mt-3 rounded-xl border border-line/70 bg-ink/50 px-3 py-2 text-center text-sm">
          <span className="font-medium text-ivory">{MUSCLE_LABELS[sel]}</span>
          <span className="text-silver">
            {' '}
            · {formatNumber(n)} série{n > 1 ? 's' : ''} (conseillé {lo}–{hi})
          </span>
          <span className={cn('ml-1.5', status === 'optimal' ? 'text-gold' : status === 'high' ? 'text-amethyst-light' : 'text-silver')}>
            {status === 'optimal' ? '✓' : status === 'high' ? 'beaucoup' : status === 'low' ? 'à renforcer' : 'non travaillé'}
          </span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-silver">
        {(
          [
            ['none', 'Rien'],
            ['low', 'Sous la cible'],
            ['optimal', 'Dans la cible'],
            ['high', 'Au-delà'],
          ] as const
        ).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-line" style={{ background: FILL[k] }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}
