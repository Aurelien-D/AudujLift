import { useLiveQuery } from 'dexie-react-hooks'
import { ChefHat, Minus, Pencil, Plus, ShoppingCart, Star, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Chip, IconButton, NumberInput, Page, Ring } from '../../components/ui'
import { db } from '../../lib/db'
import { logFood } from '../../lib/foods'
import { formatQuantity } from '../../lib/kitchen'
import { addToShopping } from '../../lib/shopping'
import { useSettings } from '../../lib/hooks'
import { defaultQuantity, MEAL_LABELS, MEALS, scaleNutrients } from '../../lib/nutrition'
import type { Food, Meal, Nutrients } from '../../lib/types'
import { cn, formatNumber, toISODate } from '../../lib/utils'
import { defaultMeal, NutriScore } from './AddFood'
import { OffContribute } from './OffContribute'

const ROWS: { key: keyof Nutrients; label: string; unit: string; indent?: boolean }[] = [
  { key: 'kcal', label: 'Énergie', unit: 'kcal' },
  { key: 'fat', label: 'Lipides', unit: 'g' },
  { key: 'saturatedFat', label: 'dont acides gras saturés', unit: 'g', indent: true },
  { key: 'carbs', label: 'Glucides', unit: 'g' },
  { key: 'sugar', label: 'dont sucres', unit: 'g', indent: true },
  { key: 'fiber', label: 'Fibres', unit: 'g' },
  { key: 'protein', label: 'Protéines', unit: 'g' },
  { key: 'salt', label: 'Sel', unit: 'g' },
]

export default function FoodDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const date = params.get('date') ?? toISODate()
  const entryId = params.get('entry') ?? undefined
  const food = useLiveQuery(() => (id ? db.foods.get(id) : undefined), [id])
  const entry = useLiveQuery(() => (entryId ? db.entries.get(entryId) : undefined), [entryId])
  const [meal, setMeal] = useState<Meal>((params.get('meal') as Meal) || defaultMeal())
  const [qty, setQty] = useState<number | undefined>()
  const [mode, setMode] = useState<'unit' | 'serving'>('unit')

  useEffect(() => {
    if (qty != null || !food) return
    if (entryId && entry === undefined) return // en attente de l'entrée à modifier
    setQty(entry?.quantity ?? defaultQuantity(food))
  }, [food, entry, entryId, qty])

  if (!food)
    return (
      <Page back title="Aliment">
        {null}
      </Page>
    )

  const quantity = mode === 'serving' && food.servingSize ? (qty ?? 0) * food.servingSize : (qty ?? 0)
  const n = scaleNutrients(food.per100, quantity)
  const g = settings.goals
  const img = food.imageUrl || food.photos?.find(Boolean)

  const save = async () => {
    await logFood(food, quantity, date, meal, entry?.id)
    navigate(`/nutrition${date === toISODate() ? '' : `?date=${date}`}`, { replace: true })
  }
  const removeEntry = async () => {
    if (!entry) return
    await db.entries.delete(entry.id)
    navigate(-1)
  }

  const presets = [...(food.servingSize ? [food.servingSize] : []), 50, 100, 150, 200, 250].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <Page
      back
      title={food.name}
      subtitle={food.brand}
      actions={
        <>
          <IconButton aria-label="Favori" onClick={() => db.foods.update(food.id, { favorite: !food.favorite })}>
            <Star size={22} className={food.favorite ? 'fill-gold text-gold' : ''} />
          </IconButton>
          <IconButton aria-label="Modifier l'aliment" onClick={() => navigate(food.recipe ? `/nutrition/recipe/${food.id}` : `/nutrition/food/${food.id}/edit`)}>
            <Pencil size={20} />
          </IconButton>
        </>
      }
    >
      {img && (
        <div className="mb-4 flex justify-center">
          <img src={img} alt={food.name} className="max-h-44 rounded-2xl object-contain" />
        </div>
      )}

      <Card>
        <div className="flex items-center gap-4">
          <Ring value={n.kcal} max={g.kcal} size={96} stroke={8}>
            <span className="font-display text-xl font-semibold">{Math.round(n.kcal)}</span>
            <span className="text-[10px] text-silver">kcal</span>
          </Ring>
          <div className="grid flex-1 grid-cols-3 gap-2 text-center">
            {[
              { label: 'Protéines', v: n.protein, goal: g.protein, color: 'text-protein' },
              { label: 'Glucides', v: n.carbs, goal: g.carbs, color: 'text-carbs' },
              { label: 'Lipides', v: n.fat, goal: g.fat, color: 'text-fat' },
            ].map((m) => (
              <div key={m.label}>
                <div className={cn('font-display text-lg font-semibold', m.color)}>{formatNumber(m.v)}</div>
                <div className="text-[11px] text-silver">{m.label}</div>
                <div className="text-[10px] text-silver">{m.goal ? Math.round((m.v / m.goal) * 100) : 0} % obj.</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs text-silver">Quantité</div>
            <NumberInput value={qty} onChange={setQty} className="font-display text-xl font-semibold" aria-label="Quantité" />
          </div>
          {food.servingSize ? (
            <div className="flex rounded-xl bg-ink p-1">
              {(['unit', 'serving'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    if (m === mode) return
                    setMode(m)
                    setQty(m === 'serving' ? Math.round(((qty ?? 0) / food.servingSize!) * 10) / 10 || 1 : Math.round((qty ?? 1) * food.servingSize!))
                  }}
                  className={cn('rounded-lg px-3 py-2 text-sm', mode === m ? 'bg-line font-semibold' : 'text-silver')}
                >
                  {m === 'unit' ? food.unit : 'portion'}
                </button>
              ))}
            </div>
          ) : (
            <span className="pb-3 text-silver">{food.unit}</span>
          )}
        </div>
        {mode === 'unit' && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {presets.map((p) => (
              <Chip key={p} active={qty === p} onClick={() => setQty(p)}>
                {p === food.servingSize ? `1 portion (${p} ${food.unit})` : `${p} ${food.unit}`}
              </Chip>
            ))}
          </div>
        )}
        {mode === 'serving' && food.servingLabel && <p className="mt-2 text-xs text-silver">1 portion = {food.servingLabel}</p>}

        <div className="mt-4 mb-1 text-xs text-silver">Repas</div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {MEALS.map((m) => (
            <Chip key={m} active={meal === m} onClick={() => setMeal(m)}>
              {MEAL_LABELS[m]}
            </Chip>
          ))}
        </div>
        <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!quantity} onClick={save}>
          {entry ? 'Mettre à jour' : `Ajouter au ${MEAL_LABELS[meal].toLowerCase()}`}
        </Button>
        {entry && (
          <Button variant="danger" className="mt-2 w-full" onClick={removeEntry}>
            <Trash2 size={18} /> Retirer du journal
          </Button>
        )}
      </Card>

      <h2 className="label mt-6 mb-2">Valeurs nutritionnelles</h2>
      <Card className="p-0">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-line/70 px-4 py-2 text-xs text-silver">
          <span />
          <span className="text-right">100 {food.unit}</span>
          <span className="w-16 text-right">
            {formatNumber(quantity, 0)} {food.unit}
          </span>
        </div>
        {ROWS.filter((r) => food.per100[r.key] != null).map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-line/50 px-4 py-2 text-sm last:border-0">
            <span className={cn(r.indent ? 'pl-3 text-silver' : 'font-medium')}>{r.label}</span>
            <span className="text-right text-silver">
              {formatNumber(food.per100[r.key]!, r.key === 'kcal' ? 0 : 1)} {r.unit}
            </span>
            <span className="w-16 text-right font-semibold">
              {formatNumber(n[r.key] ?? 0, r.key === 'kcal' ? 0 : 1)} {r.unit}
            </span>
          </div>
        ))}
      </Card>
      <div className="mt-3 flex items-center justify-between text-xs text-silver">
        <span>{food.source === 'off' ? 'Source : Open Food Facts' : food.source === 'ciqual' ? 'Source : table Ciqual 2025 (ANSES)' : 'Aliment créé par toi'}</span>
        <span className="flex items-center gap-2">
          {food.barcode && <span>EAN {food.barcode}</span>}
          <NutriScore grade={food.nutriscore} />
        </span>
      </div>
      {food.recipe && <RecipeCard food={food} />}
      <OffContribute food={food} />
      {food.photos && food.photos.filter(Boolean).length > 1 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {food.photos.filter(Boolean).map((p, i) => (
            <img key={i} src={p} alt="" className="rounded-xl" />
          ))}
        </div>
      )}
    </Page>
  )
}

/** Ingrédients d'une recette, avec ajout à la liste de courses pour le nombre de portions voulu. */
function RecipeCard({ food }: { food: Food }) {
  const recipe = food.recipe!
  const [portions, setPortions] = useState(recipe.portions)
  const factor = portions / Math.max(1, recipe.portions)
  return (
    <Card className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <ChefHat size={18} className="text-gold" />
        <h2 className="font-semibold">Ingrédients</h2>
        <span className="ml-auto flex items-center gap-1 text-sm text-silver">
          <button
            aria-label="Moins de portions"
            onClick={() => setPortions((p) => Math.max(1, p - 1))}
            className="press flex size-8 items-center justify-center rounded-lg bg-raised"
          >
            <Minus size={14} />
          </button>
          <span className="w-20 text-center">
            {portions} portion{portions > 1 ? 's' : ''}
          </span>
          <button aria-label="Plus de portions" onClick={() => setPortions((p) => p + 1)} className="press flex size-8 items-center justify-center rounded-lg bg-raised">
            <Plus size={14} />
          </button>
        </span>
      </div>
      <ul className="divide-y divide-line/50 text-sm">
        {recipe.ingredients.map((i, k) => (
          <li key={k} className="flex justify-between gap-3 py-2">
            <span className="truncate text-ivory-dim">{i.name}</span>
            <span className="shrink-0 text-ivory">{formatQuantity(i.quantity * factor, i.unit)}</span>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3 w-full"
        onClick={async () => {
          await addToShopping(recipe.ingredients.map((i) => ({ foodId: i.foodId, name: i.name, quantity: Math.round(i.quantity * factor), unit: i.unit })))
          alert(`Ingrédients pour ${portions} portion${portions > 1 ? 's' : ''} ajoutés à la liste de courses.`)
        }}
      >
        <ShoppingCart size={16} /> Ajouter à la liste de courses
      </Button>
    </Card>
  )
}
