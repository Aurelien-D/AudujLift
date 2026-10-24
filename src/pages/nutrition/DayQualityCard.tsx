import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Card } from '../../components/ui'
import { db } from '../../lib/db'
import { dayQuality } from '../../lib/kitchen'
import { cn, formatNumber } from '../../lib/utils'
import { NutriScore } from './AddFood'

/** Qualité de la journée : fibres, sucres, graisses saturées, sel et Nutri-Score moyen. */
export function DayQualityCard({ date, kcalGoal }: { date: string; kcalGoal: number }) {
  const data = useLiveQuery(async () => {
    const entries = await db.entries.where('date').equals(date).toArray()
    const ids = [...new Set(entries.map((e) => e.foodId).filter((x): x is string => !!x))]
    const foods = (await db.foods.bulkGet(ids)).filter((f) => !!f)
    return { entries, foods: new Map(foods.map((f) => [f.id, f])) }
  }, [date])
  const q = useMemo(() => (data ? dayQuality(data.entries, data.foods, kcalGoal) : undefined), [data, kcalGoal])
  if (!q || !data?.entries.length) return null

  return (
    <Card className="mt-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Qualité du jour</h2>
        {q.nutriscore && (
          <span className="flex items-center gap-1.5 text-xs text-silver">
            Nutri-Score moyen <NutriScore grade={q.nutriscore} />
          </span>
        )}
      </div>
      <div className="space-y-3">
        {q.lines.map((l) => {
          const pct = l.ref ? l.value / l.ref : 0
          const good = l.kind === 'min' ? pct >= 1 : pct <= 1
          const color = l.kind === 'min' ? (pct >= 1 ? 'bg-success' : 'bg-gold') : pct > 1 ? 'bg-danger' : pct > 0.8 ? 'bg-warn' : 'bg-success'
          return (
            <div key={l.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ivory-dim">
                  {l.label}
                  <span className="ml-1 text-[11px] text-silver-dim">{l.kind === 'min' ? `objectif ≥ ${l.ref} g` : `max ${l.ref} g`}</span>
                </span>
                <span className={cn('font-semibold', good ? 'text-ivory' : l.kind === 'max' ? 'text-danger' : 'text-gold')}>
                  {formatNumber(l.value, l.key === 'salt' ? 1 : 0)} g
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                <div className={cn('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${Math.min(100, pct * 100)}%` }} />
              </div>
              {l.coverage < 0.8 && <div className="mt-0.5 text-[11px] text-silver-dim">Valeur partielle : connue pour {Math.round(l.coverage * 100)} % des calories</div>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
