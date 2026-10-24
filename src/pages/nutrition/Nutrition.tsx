import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Copy, Droplets, Minus, MoreHorizontal, Plus, ScanBarcode } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ActionList, Card, IconButton, MacroBar, MacroLine, Page, Ring, Sheet } from '../../components/ui'
import { db } from '../../lib/db'
import { useSettings } from '../../lib/hooks'
import { MEAL_LABELS, MEALS, sumNutrients } from '../../lib/nutrition'
import type { FoodEntry, Meal } from '../../lib/types'
import { addDays, cn, formatDayLabel, formatNumber, toISODate, uid } from '../../lib/utils'

const MEAL_EMOJI: Record<Meal, string> = { breakfast: '🥣', lunch: '🍽️', snack: '🍎', dinner: '🌙' }

export function NutritionSummary({ date, compact }: { date: string; compact?: boolean }) {
  const settings = useSettings()
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).toArray(), [date])
  const total = sumNutrients((entries ?? []).map((e) => e.nutrients))
  const g = settings.goals
  const remaining = g.kcal - total.kcal
  return (
    <Card>
      <div className="flex items-center gap-4">
        <Ring value={total.kcal} max={g.kcal} size={compact ? 104 : 124} stroke={compact ? 9 : 11}>
          <span className={cn('font-black tabular-nums', compact ? 'text-xl' : 'text-2xl', remaining < 0 && 'text-rose-400')}>{Math.abs(Math.round(remaining))}</span>
          <span className="text-[11px] text-zinc-400">{remaining >= 0 ? 'kcal restantes' : 'kcal en trop'}</span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>
              Mangé <span className="font-semibold text-zinc-100">{Math.round(total.kcal)}</span>
            </span>
            <span>
              Objectif <span className="font-semibold text-zinc-100">{g.kcal}</span>
            </span>
          </div>
          <MacroBar label="Protéines" value={total.protein} goal={g.protein} color="var(--color-protein)" />
          <MacroBar label="Glucides" value={total.carbs} goal={g.carbs} color="var(--color-carbs)" />
          <MacroBar label="Lipides" value={total.fat} goal={g.fat} color="var(--color-fat)" />
        </div>
      </div>
    </Card>
  )
}

export default function Nutrition() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? toISODate()
  const setDate = (d: string) => setParams(d === toISODate() ? {} : { date: d }, { replace: true })
  const settings = useSettings()
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date])
  const day = useLiveQuery(() => db.days.get(date), [date])
  const [mealMenu, setMealMenu] = useState<Meal | null>(null)

  const water = day?.waterMl ?? 0
  const addWater = (ml: number) => db.days.put({ date, waterMl: Math.max(0, water + ml) })

  const copyFromYesterday = async (meal: Meal) => {
    const prev = await db.entries
      .where('date')
      .equals(addDays(date, -1))
      .filter((e) => e.meal === meal)
      .toArray()
    if (!prev.length) return alert(`Rien à copier : aucun aliment au ${MEAL_LABELS[meal].toLowerCase()} de la veille.`)
    await db.entries.bulkAdd(prev.map((e) => ({ ...e, id: uid(), date, createdAt: Date.now() })))
    setMealMenu(null)
  }
  const clearMeal = async (meal: Meal) => {
    if (!confirm(`Vider le ${MEAL_LABELS[meal].toLowerCase()} ?`)) return
    await db.entries.bulkDelete((entries ?? []).filter((e) => e.meal === meal).map((e) => e.id))
    setMealMenu(null)
  }

  const openEntry = (e: FoodEntry) => {
    if (e.foodId) navigate(`/nutrition/food/${e.foodId}?date=${date}&meal=${e.meal}&entry=${e.id}`)
    else if (confirm(`Supprimer « ${e.name} » ?`)) void db.entries.delete(e.id)
  }

  return (
    <Page
      title="Nutrition"
      actions={
        <IconButton aria-label="Scanner" onClick={() => navigate(`/nutrition/add?date=${date}&scan=1`)}>
          <ScanBarcode size={22} />
        </IconButton>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <IconButton aria-label="Jour précédent" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft size={22} />
        </IconButton>
        <label className="relative font-semibold">
          {formatDayLabel(date)}
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0" />
        </label>
        <IconButton aria-label="Jour suivant" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight size={22} />
        </IconButton>
      </div>

      <NutritionSummary date={date} />

      <div className="mt-4 space-y-3">
        {MEALS.map((meal) => {
          const list = (entries ?? []).filter((e) => e.meal === meal)
          const t = sumNutrients(list.map((e) => e.nutrients))
          return (
            <Card key={meal} className="p-0">
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <span className="text-xl">{MEAL_EMOJI[meal]}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{MEAL_LABELS[meal]}</h3>
                  {list.length > 0 && <MacroLine {...t} />}
                </div>
                <IconButton aria-label="Options du repas" onClick={() => setMealMenu(meal)}>
                  <MoreHorizontal size={20} />
                </IconButton>
                <button
                  aria-label={`Ajouter au ${MEAL_LABELS[meal]}`}
                  onClick={() => navigate(`/nutrition/add?date=${date}&meal=${meal}`)}
                  className="flex size-9 items-center justify-center rounded-full bg-lime-400 text-zinc-950 active:brightness-90"
                >
                  <Plus size={20} strokeWidth={2.5} />
                </button>
              </div>
              {list.length > 0 && (
                <ul className="border-t border-zinc-800/70">
                  {list.map((e) => (
                    <li key={e.id}>
                      <button onClick={() => openEntry(e)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-800/60">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{e.name}</div>
                          <div className="truncate text-xs text-zinc-500">
                            {e.quantity > 0
                              ? `${formatNumber(e.quantity, 0)} ${e.unit}`
                              : `P ${Math.round(e.nutrients.protein)} · G ${Math.round(e.nutrients.carbs)} · L ${Math.round(e.nutrients.fat)}`}
                            {e.brand && ` · ${e.brand}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{Math.round(e.nutrients.kcal)}</div>
                          <div className="text-[10px] text-zinc-500">kcal</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      <Card className="mt-3">
        <div className="flex items-center gap-3">
          <Droplets className="text-sky-400" size={24} />
          <div className="min-w-0 flex-1">
            <div className="font-bold">Hydratation</div>
            <div className="text-xs text-zinc-400">
              {(water / 1000).toLocaleString('fr-FR')} L / {(settings.goals.waterMl / 1000).toLocaleString('fr-FR')} L
            </div>
          </div>
          <IconButton aria-label="Retirer un verre" onClick={() => addWater(-250)} disabled={water <= 0} className="bg-zinc-800">
            <Minus size={18} />
          </IconButton>
          <button onClick={() => addWater(250)} className="rounded-full bg-sky-500/20 px-3 py-2 text-sm font-semibold text-sky-300 active:bg-sky-500/30">
            +250 ml
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: Math.max(1, Math.ceil(settings.goals.waterMl / 250)) }, (_, i) => (
            <div key={i} className={cn('h-2 flex-1 rounded-full transition-colors', i < water / 250 ? 'bg-sky-400' : 'bg-zinc-800')} />
          ))}
        </div>
      </Card>

      <Sheet open={!!mealMenu} onClose={() => setMealMenu(null)} title={mealMenu ? MEAL_LABELS[mealMenu] : ''}>
        {mealMenu && (
          <ActionList
            items={[
              { icon: <Plus size={20} />, label: 'Ajouter un aliment', onClick: () => navigate(`/nutrition/add?date=${date}&meal=${mealMenu}`) },
              { icon: <Copy size={20} />, label: 'Copier le repas de la veille', onClick: () => copyFromYesterday(mealMenu) },
              { icon: <Minus size={20} />, label: 'Vider ce repas', onClick: () => clearMeal(mealMenu), danger: true },
            ]}
          />
        )}
      </Sheet>
    </Page>
  )
}
