import { useLiveQuery } from 'dexie-react-hooks'
import { Sparkles } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { db, saveSettings } from '../../lib/db'
import { useSettings } from '../../lib/hooks'
import { GOAL_LABELS, rebalanceGoals } from '../../lib/nutrition'
import { estimateTdee } from '../../lib/tdee'
import { addDays, formatNumber, toISODate } from '../../lib/utils'

const WINDOW_DAYS = 28

/** Calcule la dépense réelle sur 4 semaines (hors aujourd'hui, encore incomplet). */
function useTdee() {
  return useLiveQuery(async () => {
    const to = addDays(toISODate(), -1)
    const from = addDays(to, -(WINDOW_DAYS - 1))
    const [weights, entries] = await Promise.all([
      db.bodyweights.where('date').between(from, to, true, true).toArray(),
      db.entries.where('date').between(from, to, true, true).toArray(),
    ])
    const byDay = new Map<string, number>()
    for (const e of entries) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.nutrients.kcal)
    return estimateTdee(
      weights,
      [...byDay].map(([date, kcal]) => ({ date, kcal })),
      { from, to },
    )
  }, [])
}

/** Ajustement intelligent des calories (inspiré de MacroFactor) : n'apparaît qu'avec assez de données réelles. */
export function SmartCalories() {
  const settings = useSettings()
  const est = useTdee()
  if (!est || est.tdee < 1200 || est.tdee > 5000) return null
  if (settings.tdeeSnoozeUntil && settings.tdeeSnoozeUntil > Date.now()) return null
  const target = Math.round((est.tdee * (1 + GOAL_LABELS[settings.goal].delta)) / 10) * 10
  const delta = target - settings.goals.kcal
  if (Math.abs(delta) < 75) return null

  const apply = async () => {
    await saveSettings({
      goals: { ...settings.goals, ...rebalanceGoals(settings.goals, target) },
      restGoals: settings.splitGoals ? rebalanceGoals(settings.restGoals, Math.max(1200, settings.restGoals.kcal + delta)) : settings.restGoals,
    })
  }
  const trend = est.kgPerWeek
  return (
    <Card className="animate-rise mt-3 border-gold/25">
      <div className="flex items-start gap-3">
        <Sparkles size={20} className="mt-0.5 shrink-0 text-gold" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-display font-semibold text-ivory">Ajustement intelligent</div>
          <p className="mt-1 text-silver">
            Sur {est.loggedDays} jours suivis : apport moyen <b className="text-ivory">{est.avgIntake} kcal</b>, poids {trend >= 0 ? '+' : '−'}
            {formatNumber(Math.abs(trend), 2)} kg/sem. Ta dépense réelle est estimée à <b className="text-ivory">{est.tdee} kcal/j</b>.
          </p>
          <p className="mt-1.5 text-gold-pale">
            Objectif « {GOAL_LABELS[settings.goal].label} » : vise {target} kcal ({delta > 0 ? '+' : '−'}
            {Math.abs(delta)} kcal), protéines et lipides inchangés.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={apply}>
              Appliquer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => saveSettings({ tdeeSnoozeUntil: Date.now() + 7 * 86400000 })}>
              Plus tard
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
