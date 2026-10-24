import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, EmptyState, IconButton, Page, SectionTitle } from '../../components/ui'
import { useDoneWorkouts, useExerciseMap } from '../../lib/hooks'
import { detectPRs, workoutTotals } from '../../lib/stats'
import type { Workout } from '../../lib/types'
import { capitalize, cn, formatDuration, formatNumber, formatTime, toISODate } from '../../lib/utils'

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
          <div className="text-xs text-silver">
            {count} jour{count > 1 ? 's' : ''} d'entraînement
          </div>
        </div>
        <IconButton aria-label="Mois suivant" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-silver">
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
                ws ? 'bg-gold font-semibold text-ink' : 'text-silver',
                key === today && !ws && 'ring-1 ring-gold/60',
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

const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })

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

  /** Nombre de records battus par séance */
  const prCount = useMemo(() => {
    const m = new Map<string, number>()
    if (!workouts || !exMap.size) return m
    for (const w of workouts) {
      const n = detectPRs(w, workouts, exMap, w.bodyweight).length
      if (n) m.set(w.id, n)
    }
    return m
  }, [workouts, exMap])

  return (
    <Page title="Historique" back="/workouts">
      <MonthCalendar workouts={workouts ?? []} onDay={(w) => navigate(`/workouts/history/${w.id}`)} />
      {workouts?.length === 0 && (
        <div className="mt-4">
          <EmptyState title="Aucune séance enregistrée">Tes séances terminées apparaîtront ici, avec leurs records.</EmptyState>
        </div>
      )}
      {groups.map(([month, list]) => (
        <div key={month}>
          <SectionTitle>
            {month}{' '}
            <span className="font-normal tracking-normal normal-case text-silver-dim">
              · {list.length} séance{list.length > 1 ? 's' : ''}
            </span>
          </SectionTitle>
          <ol className="relative ml-[22px] border-l border-line/80">
            {list.map((w) => {
              const t = workoutTotals(w, exMap)
              const prs = prCount.get(w.id) ?? 0
              const d = new Date(w.startedAt)
              return (
                <li key={w.id} className="relative pb-3 pl-5 last:pb-0">
                  <span className={cn('absolute top-4 -left-[5px] size-2.5 rounded-full ring-4 ring-ink', prs ? 'bg-amethyst-light' : 'bg-gold')} />
                  <button
                    onClick={() => navigate(`/workouts/history/${w.id}`)}
                    className="press w-full rounded-[18px] border border-line/70 bg-surface p-3.5 text-left active:bg-raised/60"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 shrink-0 text-center">
                        <div className="font-display text-xl leading-none font-semibold text-ivory">{d.getDate()}</div>
                        <div className="mt-0.5 text-[11px] text-silver uppercase">{weekdayFmt.format(d).replace('.', '')}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold">{w.name}</h3>
                          {prs > 0 && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full border border-amethyst/50 px-2 py-0.5 text-[11px] font-medium text-amethyst-light">
                              <Trophy size={11} /> {prs}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-silver">
                          {formatTime(w.startedAt)} · {formatDuration(t.durationMs)} · {formatNumber(t.volume, 0)} kg · {t.sets} séries
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-sm text-ivory-dim">
                          {w.exercises
                            .map((e) => exMap.get(e.exerciseId)?.name)
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </Page>
  )
}
