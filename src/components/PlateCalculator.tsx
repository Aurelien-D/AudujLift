import { useState } from 'react'
import { useSettings } from '../lib/hooks'
import { platesPerSide } from '../lib/stats'
import { Field, NumberInput, Sheet } from './ui'

const PLATE_STYLE: Record<number, { h: number; color: string }> = {
  25: { h: 96, color: '#ef4444' },
  20: { h: 96, color: '#3b82f6' },
  15: { h: 84, color: '#eab308' },
  10: { h: 72, color: '#22c55e' },
  5: { h: 56, color: '#f4f4f5' },
  2.5: { h: 44, color: '#ef4444' },
  1.25: { h: 36, color: '#a1a1aa' },
}

export function PlateCalculator({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: number }) {
  const settings = useSettings()
  const [target, setTarget] = useState<number | undefined>(initial)
  const [bar, setBar] = useState<number | undefined>(settings.barWeight)
  const { plates, remainder } = platesPerSide(target ?? 0, bar ?? 0, settings.availablePlates)
  return (
    <Sheet open={open} onClose={onClose} title="Calculateur de disques">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Charge totale (kg)">
          <NumberInput value={target} onChange={setTarget} autoFocus />
        </Field>
        <Field label="Barre (kg)">
          <NumberInput value={bar} onChange={setBar} />
        </Field>
      </div>
      <div className="mt-6 flex h-28 items-center justify-center">
        <div className="h-3 w-10 rounded-l bg-silver-dim" />
        {plates.map((p, i) => (
          <div
            key={i}
            className="mx-px flex w-4 items-center justify-center rounded-sm text-[9px] font-bold text-ink [writing-mode:vertical-rl]"
            style={{ height: PLATE_STYLE[p]?.h ?? 40, background: PLATE_STYLE[p]?.color ?? '#71717a' }}
          >
            {p}
          </div>
        ))}
        <div className="h-3 w-6 rounded-r bg-silver-dim" />
      </div>
      <p className="mt-2 text-center text-sm text-ivory-dim">
        {plates.length ? (
          <>
            De chaque côté : <span className="font-semibold text-gold-pale">{plates.join(' + ')} kg</span>
          </>
        ) : (
          'Barre seule'
        )}
      </p>
      {remainder > 0 && <p className="mt-1 text-center text-xs text-warn">{remainder} kg ne peuvent pas être chargés avec tes disques.</p>}
    </Sheet>
  )
}
