import { useLiveQuery } from 'dexie-react-hooks'
import { ChefHat, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, EmptyState, Field, IconButton, inputClass, MacroLine, NumberInput, Page, SectionTitle, Sheet } from '../../components/ui'
import { searchCiqual } from '../../lib/ciqual'
import { db } from '../../lib/db'
import { ingredientFrom, recipeNutrition } from '../../lib/kitchen'
import { searchPopularProducts } from '../../lib/offline-products'
import type { Food, RecipeIngredient } from '../../lib/types'
import { cn, formatNumber, normalize, uid } from '../../lib/utils'
import { FoodRow } from './AddFood'

export default function RecipeEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const existing = useLiveQuery(() => (id ? db.foods.get(id) : undefined), [id])
  const [name, setName] = useState('')
  const [portions, setPortions] = useState<number | undefined>(4)
  const [cooked, setCooked] = useState<number | undefined>()
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [picking, setPicking] = useState(false)
  const [loaded, setLoaded] = useState(!id)

  useEffect(() => {
    if (!existing?.recipe || loaded) return
    setName(existing.name)
    setPortions(existing.recipe.portions)
    setCooked(existing.recipe.cookedWeight)
    setIngredients(existing.recipe.ingredients)
    setLoaded(true)
  }, [existing, loaded])

  const n = recipeNutrition(ingredients, portions ?? 1, cooked)
  const valid = name.trim() && ingredients.length > 0 && n.weight > 0 && (portions ?? 0) >= 1

  const save = async () => {
    const food: Food = {
      ...(existing ?? { createdAt: Date.now() }),
      id: existing?.id ?? `recipe-${uid()}`,
      source: 'custom',
      name: name.trim(),
      unit: 'g',
      per100: n.per100,
      servingSize: Math.round(n.portionWeight),
      servingLabel: `1 portion (${Math.round(n.portionWeight)} g sur ${portions})`,
      recipe: { ingredients, portions: portions ?? 1, cookedWeight: cooked || undefined },
    }
    await db.foods.put(food)
    const date = params.get('date')
    const meal = params.get('meal')
    navigate(`/nutrition/food/${food.id}${date && meal ? `?date=${date}&meal=${meal}` : ''}`, { replace: true })
  }

  const remove = async () => {
    if (!existing || !confirm('Supprimer cette recette ? Les entrées déjà dans ton journal sont conservées.')) return
    await db.foods.delete(existing.id)
    navigate('/nutrition', { replace: true })
  }

  const setQty = (i: number, quantity: number | undefined) => setIngredients((list) => list.map((x, j) => (j === i ? { ...x, quantity: quantity ?? 0 } : x)))

  return (
    <Page
      back
      title={id ? 'Modifier la recette' : 'Nouvelle recette'}
      actions={
        <Button variant="primary" size="sm" disabled={!valid} onClick={save}>
          Enregistrer
        </Button>
      }
    >
      <Card className="space-y-3">
        <Field label="Nom de la recette *">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Bolognaise maison" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre de portions">
            <NumberInput value={portions} onChange={setPortions} decimals={false} />
          </Field>
          <Field label="Poids cuit total (g)" hint="Facultatif : pèse le plat fini">
            <NumberInput value={cooked} onChange={setCooked} decimals={false} placeholder={n.weight && !cooked ? String(Math.round(n.weight)) : ''} />
          </Field>
        </div>
      </Card>

      <SectionTitle
        action={
          <Button variant="tertiary" size="sm" onClick={() => setPicking(true)}>
            <Plus size={16} /> Ingrédient
          </Button>
        }
      >
        Ingrédients (poids cru)
      </SectionTitle>
      {ingredients.length === 0 ? (
        <Card>
          <EmptyState icon={<ChefHat size={36} className="text-gold/70" />} title="Aucun ingrédient">
            Ajoute chaque ingrédient avec son poids : les valeurs par portion se calculent toutes seules.
          </EmptyState>
          <Button variant="primary" className="mt-2 w-full" onClick={() => setPicking(true)}>
            <Plus size={18} /> Ajouter un ingrédient
          </Button>
        </Card>
      ) : (
        <Card className="divide-y divide-line/50 p-0">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{ing.name}</div>
                <div className="text-xs text-silver">
                  {Math.round((ing.per100.kcal * ing.quantity) / 100)} kcal{ing.brand ? ` · ${ing.brand}` : ''}
                </div>
              </div>
              <div className="w-20">
                <NumberInput aria-label={`Quantité de ${ing.name}`} value={ing.quantity || undefined} onChange={(v) => setQty(i, v)} className="py-2 text-right" />
              </div>
              <span className="w-5 text-xs text-silver">{ing.unit}</span>
              <IconButton aria-label={`Retirer ${ing.name}`} className="text-silver" onClick={() => setIngredients((l) => l.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </IconButton>
            </div>
          ))}
        </Card>
      )}

      {ingredients.length > 0 && (
        <Card glow className="mt-3">
          <div className="label text-gold">Par portion</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">{Math.round(n.perPortion.kcal)}</span>
            <span className="text-sm text-silver">kcal · {Math.round(n.portionWeight)} g</span>
          </div>
          <div className="mt-1">
            <MacroLine kcal={n.perPortion.kcal} protein={n.perPortion.protein} carbs={n.perPortion.carbs} fat={n.perPortion.fat} />
          </div>
          <p className="mt-2 text-xs text-silver">
            Plat entier : {Math.round(n.totals.kcal)} kcal pour {formatNumber(n.weight, 0)} g {cooked ? 'cuit' : 'cru'} · {Math.round(n.per100.kcal)} kcal/100 g
          </p>
        </Card>
      )}

      <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!valid} onClick={save}>
        Enregistrer la recette
      </Button>
      {existing && (
        <Button variant="danger" className="mt-2 w-full" onClick={remove}>
          <Trash2 size={18} /> Supprimer la recette
        </Button>
      )}

      {picking && (
        <IngredientPicker
          onClose={() => setPicking(false)}
          onPick={(food, qty) => {
            setIngredients((l) => [...l, ingredientFrom(food, qty)])
            setPicking(false)
          }}
        />
      )}
    </Page>
  )
}

function IngredientPicker({ onClose, onPick }: { onClose: () => void; onPick: (food: Food, quantity: number) => void }) {
  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const [query, setQuery] = useState('')
  const [generic, setGeneric] = useState<Food[]>([])
  const [brands, setBrands] = useState<Food[]>([])
  const [chosen, setChosen] = useState<Food | null>(null)
  const [qty, setQty] = useState<number | undefined>(100)

  const local = useMemo(() => {
    const q = normalize(query.trim())
    const list = (foods ?? []).filter((f) => !f.recipe)
    if (!q)
      return list
        .filter((f) => f.lastUsedAt)
        .sort((a, b) => b.lastUsedAt! - a.lastUsedAt!)
        .slice(0, 15)
    return list.filter((f) => normalize(`${f.name} ${f.brand ?? ''}`).includes(q)).slice(0, 10)
  }, [foods, query])

  useEffect(() => {
    let cancelled = false
    const q = query.trim()
    if (q.length < 2) {
      setGeneric([])
      setBrands([])
      return
    }
    searchCiqual(q, 12).then((r) => !cancelled && setGeneric(r))
    searchPopularProducts(q, 12).then((r) => !cancelled && setBrands(r))
    return () => {
      cancelled = true
    }
  }, [query])

  const seen = new Set(local.map((f) => f.id))
  const rest = [...generic, ...brands].filter((f) => !seen.has(f.id))

  return (
    <Sheet open onClose={onClose} title={chosen ? chosen.name : 'Ajouter un ingrédient'} full={!chosen}>
      {chosen ? (
        <div className="space-y-3">
          <Field label={`Quantité crue (${chosen.unit})`}>
            <NumberInput autoFocus value={qty} onChange={setQty} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[50, 100, 150, 200, 250, 500].map((v) => (
              <button
                key={v}
                onClick={() => setQty(v)}
                className={cn('press rounded-full border px-3 py-1.5 text-sm', qty === v ? 'border-gold/60 text-gold' : 'border-line text-ivory-dim')}
              >
                {v} {chosen.unit}
              </button>
            ))}
          </div>
          <p className="text-sm text-silver">{qty ? `${Math.round((chosen.per100.kcal * qty) / 100)} kcal` : ''}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setChosen(null)}>
              Retour
            </Button>
            <Button variant="primary" disabled={!qty} onClick={() => qty && onPick(chosen, qty)}>
              Ajouter
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 bg-surface px-4 pb-2">
            <div className="relative">
              <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-silver" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un ingrédient" className={cn(inputClass, 'pl-10')} type="search" />
            </div>
          </div>
          {[...local, ...rest].map((f) => (
            <FoodRow key={f.id} food={f} onClick={() => setChosen(f)} />
          ))}
          {query.trim().length >= 2 && local.length + rest.length === 0 && <p className="py-6 text-center text-sm text-silver">Aucun aliment trouvé.</p>}
        </>
      )}
    </Sheet>
  )
}
