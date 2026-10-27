import { useLiveQuery } from 'dexie-react-hooks'
import {
  Apple,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Copy,
  Droplets,
  Dumbbell,
  Minus,
  Moon,
  MoreHorizontal,
  Plus,
  ScanBarcode,
  ShoppingCart,
  Star,
  UtensilsCrossed,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ActionList, Card, IconButton, MacroBar, MacroLine, Page, Ring, Sheet } from '../../components/ui'
import { db } from '../../lib/db'
import { saveMealFromEntries } from '../../lib/foods'
import { useDayType, useSettings } from '../../lib/hooks'
import { goalsForDay, MEAL_LABELS, MEALS, sumNutrients } from '../../lib/nutrition'
import type { FoodEntry, Meal } from '../../lib/types'
import { addDays, cn, formatDayLabel, formatNumber, toISODate, uid } from '../../lib/utils'
import { DayQualityCard } from './DayQualityCard'
import { EntryEditor } from './EntryEditor'
import { SmartCalories } from './SmartCalories'

const MEAL_ICON: Record<Meal, typeof Coffee> = { breakfast: Coffee, lunch: UtensilsCrossed, snack: Apple, dinner: Moon }

export function NutritionSummary({ date, compact }: { date: string; compact?: boolean }) {
  const settings = useSettings()
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).toArray(), [date])
  const day = useLiveQuery(() => db.days.get(date), [date])
  const { training, manual } = useDayType(date)
  const total = sumNutrients((entries ?? []).map((e) => e.nutrients))
  const g = goalsForDay(settings, training)
  const remaining = g.kcal - total.kcal
  const toggleDayType = () => db.days.put({ date, waterMl: day?.waterMl ?? 0, ...day, dayType: training ? 'rest' : 'training' })
  return (
    <Card>
      {settings.splitGoals && (
        <button
          onClick={(e) => {
            if (compact) return
            e.stopPropagation()
            void toggleDayType()
          }}
          className={cn(
            'press mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            training ? 'border-gold/40 text-gold' : 'border-line text-silver',
          )}
          aria-label={compact ? undefined : 'Changer le type de journée'}
        >
          {training ? <Dumbbell size={13} /> : <Moon size={13} />}
          {training ? "Jour d'entraînement" : 'Jour de repos'}
          {!compact && <span className="text-silver-dim">· {manual ? 'choisi' : 'auto'}</span>}
        </button>
      )}
      <div className="flex items-center gap-4">
        <Ring value={total.kcal} max={g.kcal} size={compact ? 104 : 124} stroke={compact ? 8 : 10}>
          <span className={cn('font-display font-semibold', compact ? 'text-xl' : 'text-2xl', remaining < 0 && 'text-danger')}>{Math.abs(Math.round(remaining))}</span>
          <span className="text-[11px] text-silver">{remaining >= 0 ? 'kcal restantes' : 'kcal en trop'}</span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex justify-between text-xs text-silver">
            <span>
              Mangé <span className="font-semibold text-ivory">{Math.round(total.kcal)}</span>
            </span>
            <span>
              Objectif <span className="font-semibold text-ivory">{g.kcal}</span>
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
  const [editing, setEditing] = useState<FoodEntry | null>(null)

  const water = day?.waterMl ?? 0
  const addWater = (ml: number) => db.days.put({ ...day, date, waterMl: Math.max(0, water + ml) })

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
  const saveFavorite = async (meal: Meal) => {
    const list = (entries ?? []).filter((e) => e.meal === meal)
    if (!list.length) return alert('Ajoute d’abord des aliments à ce repas.')
    const name = prompt('Nom du repas favori', `${MEAL_LABELS[meal]} habituel`)?.trim()
    if (!name) return
    await saveMealFromEntries(name, list)
    setMealMenu(null)
    alert(`« ${name} » est dans tes repas favoris : onglet « Repas » quand tu ajoutes un aliment.`)
  }
  const clearMeal = async (meal: Meal) => {
    if (!confirm(`Vider le ${MEAL_LABELS[meal].toLowerCase()} ?`)) return
    await db.entries.bulkDelete((entries ?? []).filter((e) => e.meal === meal).map((e) => e.id))
    setMealMenu(null)
  }

  const openEntry = (e: FoodEntry) => {
    if (e.foodId) navigate(`/nutrition/food/${e.foodId}?date=${date}&meal=${e.meal}&entry=${e.id}`)
    else setEditing(e) // estimation de l'IA ou ajout rapide : pas de fiche, on modifie l'entrée elle-même
  }

  return (
    <Page
      title="Nutrition"
      actions={
        <>
          <IconButton aria-label="Liste de courses" onClick={() => navigate('/nutrition/shopping')}>
            <ShoppingCart size={21} />
          </IconButton>
          <IconButton aria-label="Scanner" onClick={() => navigate(`/nutrition/add?date=${date}&scan=1`)}>
            <ScanBarcode size={22} />
          </IconButton>
        </>
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
      {date === toISODate() && <SmartCalories />}
      <DayQualityCard date={date} kcalGoal={settings.goals.kcal} />

      <div className="mt-4 space-y-3">
        {MEALS.map((meal) => {
          const list = (entries ?? []).filter((e) => e.meal === meal)
          const t = sumNutrients(list.map((e) => e.nutrients))
          const Icon = MEAL_ICON[meal]
          return (
            <Card key={meal} className="p-0">
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-raised text-gold">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{MEAL_LABELS[meal]}</h2>
                  {list.length > 0 && <MacroLine {...t} />}
                </div>
                <IconButton aria-label="Options du repas" onClick={() => setMealMenu(meal)}>
                  <MoreHorizontal size={20} />
                </IconButton>
                <button
                  aria-label={`Ajouter au ${MEAL_LABELS[meal]}`}
                  onClick={() => navigate(`/nutrition/add?date=${date}&meal=${meal}`)}
                  className="press flex size-10 items-center justify-center rounded-full bg-gold text-ink active:bg-gold-pale"
                >
                  <Plus size={20} strokeWidth={2.5} />
                </button>
              </div>
              {list.length > 0 && (
                <ul className="border-t border-line/60">
                  {list.map((e) => (
                    <li key={e.id}>
                      <button onClick={() => openEntry(e)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-raised/60">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{e.name}</div>
                          <div className="truncate text-xs text-silver">
                            {e.quantity > 0
                              ? `${formatNumber(e.quantity, 0)} ${e.unit}`
                              : `P ${Math.round(e.nutrients.protein)} · G ${Math.round(e.nutrients.carbs)} · L ${Math.round(e.nutrients.fat)}`}
                            {e.brand && ` · ${e.brand}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{Math.round(e.nutrients.kcal)}</div>
                          <div className="text-[10px] text-silver">kcal</div>
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
          <Droplets className="text-water" size={24} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Hydratation</div>
            <div className="text-xs text-silver">
              {(water / 1000).toLocaleString('fr-FR')} L / {(settings.goals.waterMl / 1000).toLocaleString('fr-FR')} L
            </div>
          </div>
          <IconButton aria-label="Retirer un verre" onClick={() => addWater(-250)} disabled={water <= 0} className="bg-raised">
            <Minus size={18} />
          </IconButton>
          <button onClick={() => addWater(250)} className="rounded-full bg-water/20 px-3 py-2 text-sm font-semibold text-water active:bg-water/30">
            +250 ml
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: Math.max(1, Math.ceil(settings.goals.waterMl / 250)) }, (_, i) => (
            <div key={i} className={cn('h-2 flex-1 rounded-full transition-colors', i < water / 250 ? 'bg-water' : 'bg-raised')} />
          ))}
        </div>
      </Card>

      <Sheet open={!!mealMenu} onClose={() => setMealMenu(null)} title={mealMenu ? MEAL_LABELS[mealMenu] : ''}>
        {mealMenu && (
          <ActionList
            items={[
              { icon: <Plus size={20} />, label: 'Ajouter un aliment', onClick: () => navigate(`/nutrition/add?date=${date}&meal=${mealMenu}`) },
              { icon: <Copy size={20} />, label: 'Copier le repas de la veille', onClick: () => copyFromYesterday(mealMenu) },
              { icon: <Star size={20} />, label: 'Enregistrer comme repas favori', onClick: () => saveFavorite(mealMenu) },
              { icon: <Minus size={20} />, label: 'Vider ce repas', onClick: () => clearMeal(mealMenu), danger: true },
            ]}
          />
        )}
      </Sheet>
      {editing && <EntryEditor entry={editing} onClose={() => setEditing(null)} />}
    </Page>
  )
}
