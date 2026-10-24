import { TrendingDown } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveSettings } from '../lib/db'
import { useDoneWorkouts, useExerciseMap, useSettings } from '../lib/hooks'
import { stagnations } from '../lib/insights'
import { formatNumber } from '../lib/utils'
import { Button, Card } from './ui'

/** Alertes de stagnation avec proposition de semaine allégée. */
export function Stagnations({ limit = 3 }: { limit?: number }) {
  const navigate = useNavigate()
  const workouts = useDoneWorkouts()
  const exMap = useExerciseMap()
  const settings = useSettings()
  const list = useMemo(() => (workouts && exMap.size ? stagnations(workouts, exMap) : []), [workouts, exMap])

  const lastDone = (id: string) => workouts?.find((w) => w.exercises.some((e) => e.exerciseId === id))?.startedAt ?? 0
  const now = Date.now()
  const visible = list.filter((s) => {
    const dismissed = settings.stagnationDismissed?.[s.exerciseId] ?? 0
    const plan = settings.deloads?.[s.exerciseId]
    return lastDone(s.exerciseId) > dismissed && !(plan && plan.until > now)
  })
  if (!visible.length) return null

  const deload = (id: string, weight: number) => saveSettings({ deloads: { ...settings.deloads, [id]: { weight, until: Date.now() + 7 * 86400000 } } })
  const dismiss = (id: string) => saveSettings({ stagnationDismissed: { ...settings.stagnationDismissed, [id]: Date.now() } })

  return (
    <div className="space-y-2">
      {visible.slice(0, limit).map((s) => {
        const name = exMap.get(s.exerciseId)?.name ?? 'Exercice'
        return (
          <Card key={s.exerciseId} className="border-warn/30">
            <div className="flex items-start gap-3">
              <TrendingDown size={20} className="mt-0.5 shrink-0 text-warn" />
              <div className="min-w-0 flex-1 text-sm">
                <button onClick={() => navigate(`/exercises/${s.exerciseId}`)} className="text-left font-medium text-ivory">
                  {name} stagne
                </button>
                <p className="mt-0.5 text-silver">
                  {s.sessions} séances sans dépasser ton record (1RM estimé {formatNumber(s.best)} kg). Une semaine allégée à{' '}
                  <b className="text-ivory">{formatNumber(s.deloadWeight)} kg</b> (−10 %) aide souvent à repartir, ou change de variante.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => deload(s.exerciseId, s.deloadWeight)}>
                    Semaine allégée
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dismiss(s.exerciseId)}>
                    Ignorer
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
