import { Timer } from 'lucide-react'
import type { Exercise, SetType } from '../lib/types'
import { cn, formatClock } from '../lib/utils'
import { SET_TYPE_LABELS } from '../lib/workout'
import { ActionList, Sheet } from './ui'

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300]

export function RestSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 px-2 py-1 text-xs text-zinc-300">
      <Timer size={14} className="text-lime-400" />
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="appearance-none bg-transparent outline-none">
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

const SUPERSET_COLORS = ['#a78bfa', '#f472b6', '#38bdf8', '#fbbf24', '#34d399']
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
}

/** Colonnes affichées selon le type d'exercice */
export function columnsFor(kind: Exercise['kind']): [Column, Column] {
  switch (kind) {
    case 'bodyweight':
      return [
        { key: 'weight', label: '+kg', decimals: true },
        { key: 'reps', label: 'Reps', decimals: false },
      ]
    case 'duration':
      return [
        { key: 'weight', label: '+kg', decimals: true },
        { key: 'duration', label: 'Sec', decimals: false },
      ]
    case 'cardio':
      return [
        { key: 'distance', label: 'Km', decimals: true },
        { key: 'duration', label: 'Min', scale: 60, decimals: true },
      ]
    default:
      return [
        { key: 'weight', label: 'kg', decimals: true },
        { key: 'reps', label: 'Reps', decimals: false },
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
