import { ChevronLeft, ChevronRight, History as HistoryIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, EmptyState, IconButton, Page, SectionTitle } from '../../components/ui'
import { useDoneWorkouts, useExerciseMap } from '../../lib/hooks'
import { workoutTotals } from '../../lib/stats'
import type { Workout } from '../../lib/types'
import { capitalize, cn, formatDate, formatDuration, formatNumber, toISODate } from '../../lib/utils'

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

export function MonthCalendar({ workouts, onDay }: { workouts: Workout[]; onDay?: (w: Workout) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const byDay = useMemo(() => {
    const m = new Map<string, Workout[]>()
    for (const w of workouts) {
      const k = toISODate(new Date(w.startedAt))
      m.set(k, [...(m.get(k) ?? []), w])
    }
    return m
  }, [workouts])
  const first = (cursor.getDay() + 6) % 7
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const today = toISODate()
  const count = [...byDay.keys()].filter((k) => k.startsWith(toISODate(cursor).slice(0, 7))).length
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <IconButton aria-label="Mois précédent" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <div className="text-center">
          <div className="font-semibold">{capitalize(monthFmt.format(cursor))}</div>
          <div className="text-xs text-zinc-400">
            {count} jour{count > 1 ? 's' : ''} d'entraînement
          </div>
        </div>
        <IconButton aria-label="Mois suivant" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-400">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const key = toISODate(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))
          const ws = byDay.get(key)
          return (
            <button
              key={key}
              disabled={!ws}
              onClick={() => ws && onDay?.(ws[0])}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg text-sm',
                ws ? 'bg-gradient-accent font-bold text-zinc-950' : 'text-zinc-400',
                key === today && !ws && 'ring-1 ring-lime-400/60',
              )}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

export default function History() {
  const navigate = useNavigate()
  const workouts = useDoneWorkouts()
  const exMap = useExerciseMap()

  const groups = useMemo(() => {
    const m = new Map<string, Workout[]>()
    for (const w of workouts ?? []) {
      const k = capitalize(monthFmt.format(w.startedAt))
      m.set(k, [...(m.get(k) ?? []), w])
    }
    return [...m.entries()]
  }, [workouts])

  return (
    <Page title="Historique" back="/workouts">
      <MonthCalendar workouts={workouts ?? []} onDay={(w) => navigate(`/workouts/history/${w.id}`)} />
      {workouts?.length === 0 && (
        <div className="mt-4">
          <EmptyState icon={<HistoryIcon size={40} />} title="Aucune séance enregistrée">
            Tes séances terminées apparaîtront ici.
          </EmptyState>
        </div>
      )}
      {groups.map(([month, list]) => (
        <div key={month}>
          <SectionTitle>
            {month} <span className="text-zinc-400">· {list.length} séances</span>
          </SectionTitle>
          <div className="space-y-2">
            {list.map((w) => {
              const t = workoutTotals(w, exMap)
              return (
                <Card key={w.id} onClick={() => navigate(`/workouts/history/${w.id}`)} className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-semibold">{w.name}</h3>
                    <span className="shrink-0 text-xs text-zinc-400">{formatDate(w.startedAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {formatDuration(t.durationMs)} · {formatNumber(t.volume, 0)} kg · {t.sets} séries
                  </p>
                  <ul className="mt-2 space-y-0.5 text-sm text-zinc-300">
                    {w.exercises.slice(0, 4).map((e) => (
                      <li key={e.uid} className="truncate">
                        <span className="text-zinc-400">{e.sets.length} ×</span> {exMap.get(e.exerciseId)?.name}
                      </li>
                    ))}
                    {w.exercises.length > 4 && <li className="text-xs text-zinc-400">+ {w.exercises.length - 4} autres</li>}
                  </ul>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </Page>
  )
}
