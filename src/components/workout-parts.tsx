import { Minus, Plus, Timer, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import type { Exercise, SetType } from '../lib/types'
import { cn, formatClock } from '../lib/utils'
import { SET_TYPE_LABELS } from '../lib/workout'
import { ActionList, Sheet } from './ui'

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300]

export function RestSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg bg-raised/80 px-2.5 text-xs text-ivory-dim">
      <Timer size={14} className="text-gold" />
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-h-9 appearance-none bg-transparent outline-none">
        {REST_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s === 0 ? 'Pas de repos' : `Repos ${formatClock(s)}`}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Libellé de la série : numéro pour les séries de travail, « É » pour l'échauffement, D/F pour dégressive/échec. */
export function setLabels(types: SetType[]): string[] {
  let n = 0
  return types.map((t) => {
    if (t === 'warmup') return SET_TYPE_LABELS.warmup.short
    n++
    return t === 'normal' ? String(n) : SET_TYPE_LABELS[t].short
  })
}

export function SetTypeSheet({ open, onClose, onPick, onDelete }: { open: boolean; onClose: () => void; onPick: (t: SetType) => void; onDelete: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Type de série">
      <ActionList
        items={[
          ...(Object.keys(SET_TYPE_LABELS) as SetType[]).map((t) => ({
            icon: <span className={cn('inline-block w-5 text-center font-bold', SET_TYPE_LABELS[t].color)}>{SET_TYPE_LABELS[t].short || '1'}</span>,
            label: SET_TYPE_LABELS[t].label,
            onClick: () => onPick(t),
          })),
          { label: 'Supprimer la série', onClick: onDelete, danger: true, icon: <span className="inline-block w-5 text-center">✕</span> },
        ]}
      />
    </Sheet>
  )
}

const SUPERSET_COLORS = ['#A58AD0', '#D98FA8', '#6FAFC9', '#E0A458', '#7FBF8E']
export function supersetColor(supersetId: string | undefined, all: (string | undefined)[]) {
  if (!supersetId) return undefined
  const ids = [...new Set(all.filter(Boolean))]
  return SUPERSET_COLORS[ids.indexOf(supersetId) % SUPERSET_COLORS.length]
}

export interface Column {
  key: 'weight' | 'reps' | 'duration' | 'distance'
  label: string
  /** Facteur d'affichage (durée cardio saisie en minutes, stockée en secondes) */
  scale?: number
  decimals: boolean
  /** Pas des boutons −/+ (dans l'unité affichée) */
  step: number
}

/** Colonnes affichées selon le type d'exercice */
export function columnsFor(kind: Exercise['kind']): [Column, Column] {
  switch (kind) {
    case 'bodyweight':
      return [
        { key: 'weight', label: '+kg', decimals: true, step: 2.5 },
        { key: 'reps', label: 'Reps', decimals: false, step: 1 },
      ]
    case 'duration':
      return [
        { key: 'weight', label: '+kg', decimals: true, step: 2.5 },
        { key: 'duration', label: 'Sec', decimals: false, step: 5 },
      ]
    case 'cardio':
      return [
        { key: 'distance', label: 'Km', decimals: true, step: 0.5 },
        { key: 'duration', label: 'Min', scale: 60, decimals: true, step: 1 },
      ]
    default:
      return [
        { key: 'weight', label: 'kg', decimals: true, step: 2.5 },
        { key: 'reps', label: 'Reps', decimals: false, step: 1 },
      ]
  }
}

export function readCol(set: Partial<Record<Column['key'], number>>, col: Column): number | undefined {
  const v = set[col.key]
  return v == null ? undefined : col.scale ? Math.round((v / col.scale) * 100) / 100 : v
}

export function writeCol(v: number | undefined, col: Column): number | undefined {
  return v == null ? undefined : col.scale ? Math.round(v * col.scale) : v
}

/** Résumé d'une série : "80 kg × 8", "+10 kg × 12", "45 s", "5 km · 25 min" */
export function formatSet(s: Partial<Record<Column['key'], number>>, kind: Exercise['kind']): string {
  switch (kind) {
    case 'bodyweight':
      return `${s.weight ? `+${s.weight} kg × ` : ''}${s.reps ?? 0} reps`
    case 'duration':
      return `${s.weight ? `+${s.weight} kg · ` : ''}${s.duration ?? 0} s`
    case 'cardio':
      return [s.distance ? `${s.distance} km` : '', s.duration ? `${Math.round(s.duration / 60)} min` : ''].filter(Boolean).join(' · ') || '—'
    default:
      return `${s.weight ?? 0} kg × ${s.reps ?? 0}`
  }
}

/** Boutons −/+ pour ajuster la série en cours d'une main (±2,5 kg, ±1 rep…). */
export function SetStepper({
  set,
  cols,
  onChange,
}: {
  set: Partial<Record<Column['key'], number>>
  cols: Column[]
  onChange: (key: Column['key'], value: number | undefined) => void
}) {
  return (
    <div className="animate-fade mt-1.5 grid grid-cols-2 gap-2">
      {cols.map((col) => {
        const v = readCol(set, col) ?? 0
        const bump = (d: number) => {
          navigator.vibrate?.(8)
          const next = Math.max(0, Math.round((v + d) * 100) / 100)
          onChange(col.key, writeCol(next, col))
        }
        const stepLabel = String(col.step).replace('.', ',')
        return (
          <div key={col.key} className="flex items-center gap-1 rounded-xl border border-line bg-ink/60 p-1">
            <button
              aria-label={`${col.label} −${stepLabel}`}
              onClick={() => bump(-col.step)}
              className="press flex h-10 flex-1 items-center justify-center rounded-lg bg-raised text-ivory active:bg-line"
            >
              <Minus size={16} />
            </button>
            <span className="w-11 text-center text-[11px] leading-tight text-silver">
              {col.label}
              <br />
              <span className="text-gold">±{stepLabel}</span>
            </span>
            <button
              aria-label={`${col.label} +${stepLabel}`}
              onClick={() => bump(col.step)}
              className="press flex h-10 flex-1 items-center justify-center rounded-lg bg-raised text-ivory active:bg-line"
            >
              <Plus size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Sélecteur d'effort ressenti (RPE 6 à 10 ; RIR = 10 − RPE). */
export function RpePicker({ value, onPick, onClose }: { value?: number; onPick: (v: number | undefined) => void; onClose: () => void }) {
  return (
    <div className="animate-fade mt-1.5 flex items-center gap-1.5 rounded-xl border border-line/70 bg-ink/50 px-2 py-1.5">
      <span className="mr-auto text-[11px] leading-tight text-silver">
        Effort
        <br />
        (RPE)
      </span>
      {[6, 7, 8, 9, 10].map((r) => (
        <button
          key={r}
          aria-label={`RPE ${r} — ${10 - r} rep${10 - r > 1 ? 's' : ''} en réserve`}
          onClick={() => onPick(value === r ? undefined : r)}
          className={cn('press size-9 rounded-lg text-sm font-semibold', value === r ? 'bg-gold text-ink' : 'bg-raised text-ivory-dim active:bg-line')}
        >
          {r}
        </button>
      ))}
      <button aria-label="Fermer" onClick={onClose} className="press ml-0.5 size-9 rounded-lg text-silver active:bg-raised">
        ✕
      </button>
    </div>
  )
}

/** Ligne glissable vers la gauche pour supprimer (le geste vertical reste libre pour défiler). */
export function SwipeRow({ children, onDelete, className }: { children: ReactNode; onDelete: () => void; className?: string }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; swiping: boolean } | null>(null)
  const THRESHOLD = 96
  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-end rounded-xl px-4 text-sm font-medium transition-colors',
          dx < -THRESHOLD ? 'bg-danger text-ink' : 'bg-danger/25 text-danger',
        )}
        aria-hidden
      >
        <Trash2 size={18} />
      </div>
      <div
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
        className={cn('relative bg-surface', !dragging && 'transition-transform duration-200')}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          start.current = { x: e.clientX, y: e.clientY, swiping: false }
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s) return
          const mx = e.clientX - s.x
          const my = e.clientY - s.y
          if (!s.swiping) {
            if (Math.abs(my) > 10) return void (start.current = null)
            if (mx < -12 && Math.abs(mx) > Math.abs(my) * 1.5) {
              s.swiping = true
              setDragging(true)
              e.currentTarget.setPointerCapture(e.pointerId)
            } else return
          }
          setDx(Math.min(0, mx))
        }}
        onPointerUp={() => {
          const swiped = start.current?.swiping && dx < -THRESHOLD
          start.current = null
          setDragging(false)
          setDx(0)
          if (swiped) {
            navigator.vibrate?.(20)
            onDelete()
          }
        }}
        onPointerCancel={() => {
          start.current = null
          setDragging(false)
          setDx(0)
        }}
      >
        {children}
      </div>
    </div>
  )
}
