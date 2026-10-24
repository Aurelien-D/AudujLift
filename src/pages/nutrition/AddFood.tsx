import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ChefHat, Loader2, PenLine, ScanBarcode, Search, ShoppingCart, Star, Trash2, Utensils, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarcodeScanner } from '../../components/BarcodeScanner'
import { Button, Chip, EmptyState, Field, IconButton, inputClass, MacroLine, NumberInput, Page, SectionTitle, Sheet, Tabs } from '../../components/ui'
import { db } from '../../lib/db'
import { ensureFood, logSavedMeal, lookupBarcode } from '../../lib/foods'
import { addToShopping } from '../../lib/shopping'
import { kcalFromMacros, MEAL_LABELS, MEALS, sumNutrients } from '../../lib/nutrition'
import { searchCiqual } from '../../lib/ciqual'
import { searchProducts } from '../../lib/off'
import { searchPopularProducts } from '../../lib/offline-products'
import type { Food, Meal, SavedMeal } from '../../lib/types'
import { cn, normalize, toISODate, uid } from '../../lib/utils'

export function defaultMeal(): Meal {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner'
}

export function NutriScore({ grade }: { grade?: string }) {
  if (!grade) return null
  const colors: Record<string, string> = { a: '#038141', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63e11' }
  return (
    <span className="inline-flex size-5 items-center justify-center rounded text-[11px] font-black text-white uppercase" style={{ background: colors[grade] }} title="Nutri-Score">
      {grade}
    </span>
  )
}

export function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  const img = food.imageUrl || food.photos?.find(Boolean)
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-raised">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-raised">
        {img ? (
          <img src={img} alt="" loading="lazy" className="size-full object-cover" />
        ) : food.recipe ? (
          <ChefHat size={18} strokeWidth={1.75} className="text-gold" />
        ) : (
          <Utensils size={18} strokeWidth={1.75} className="text-silver" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{food.name}</span>
          {food.favorite && <Star size={12} className="shrink-0 fill-gold text-gold" />}
        </div>
        <div className="truncate text-xs text-silver">
          {food.brand ? `${food.brand} · ` : ''}
          {Math.round(food.per100.kcal)} kcal · P {Math.round(food.per100.protein)} · G {Math.round(food.per100.carbs)} · L {Math.round(food.per100.fat)}{' '}
          <span className="text-silver">/100{food.unit}</span>
        </div>
      </div>
      <NutriScore grade={food.nutriscore} />
    </button>
  )
}

type Tab = 'recent' | 'favorites' | 'meals' | 'mine'

export default function AddFood() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const date = params.get('date') ?? toISODate()
  const [meal, setMeal] = useState<Meal>((params.get('meal') as Meal) || defaultMeal())
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('recent')
  const [scan, setScan] = useState(params.get('scan') === '1')
  const [quick, setQuick] = useState(false)
  const [remote, setRemote] = useState<{ loading: boolean; error?: string; results: Food[] }>({ loading: false, results: [] })
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [generic, setGeneric] = useState<Food[]>([])
  const [popular, setPopular] = useState<Food[]>([])
  const [retry, setRetry] = useState(0)

  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const meals = useLiveQuery(async () => (await db.meals.toArray()).sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt)), [])
  const ctx = `date=${date}&meal=${meal}`

  const local = useMemo(() => {
    const q = normalize(query.trim())
    const list = foods ?? []
    if (q) return list.filter((f) => normalize(`${f.name} ${f.brand ?? ''}`).includes(q)).slice(0, 15)
    if (tab === 'recent')
      return list
        .filter((f) => f.lastUsedAt)
        .sort((a, b) => b.lastUsedAt! - a.lastUsedAt!)
        .slice(0, 40)
    if (tab === 'favorites') return list.filter((f) => f.favorite).sort((a, b) => a.name.localeCompare(b.name))
    return list.filter((f) => f.source === 'custom').sort((a, b) => a.name.localeCompare(b.name))
  }, [foods, query, tab])

  const genericShown = generic.filter((g) => !local.some((l) => l.id === g.id)).slice(0, 8)
  // Produits de marque : sélection hors ligne d'abord (instantanée), complétée par la recherche en ligne
  const brands = useMemo(() => {
    const seen = new Set(local.map((l) => l.barcode).filter(Boolean))
    const out: Food[] = []
    for (const f of [...popular, ...remote.results]) {
      if (f.barcode && seen.has(f.barcode)) continue
      if (f.barcode) seen.add(f.barcode)
      out.push(f)
    }
    return out.slice(0, 40)
  }, [popular, remote.results, local])

  // Aliments génériques Ciqual : recherche locale, instantanée et hors connexion
  useEffect(() => {
    let cancelled = false
    const q = query.trim()
    if (q.length < 2) {
      setGeneric([])
      setPopular([])
      return
    }
    searchCiqual(q).then((r) => !cancelled && setGeneric(r))
    searchPopularProducts(q).then((r) => !cancelled && setPopular(r))
    return () => {
      cancelled = true
    }
  }, [query])

  // Produits de marque Open Food Facts (avec temporisation pendant la frappe)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) return setRemote({ loading: false, results: [] })
    const ctrl = new AbortController()
    setRemote((r) => ({ ...r, loading: true, error: undefined }))
    const t = setTimeout(() => {
      searchProducts(q, ctrl.signal)
        .then((results) => setRemote({ loading: false, results }))
        .catch((e) => !ctrl.signal.aborted && setRemote({ loading: false, results: [], error: (e as Error).message }))
    }, 600)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, retry])

  const openFood = async (food: Food) => {
    const saved = await ensureFood(food)
    navigate(`/nutrition/food/${saved.id}?${ctx}`)
  }

  const onDetected = useCallback(
    async (code: string) => {
      setScan(false)
      setScanStatus(`Recherche du produit ${code}…`)
      const res = await lookupBarcode(code)
      setScanStatus(null)
      if (res.status === 'found') navigate(`/nutrition/food/${res.food.id}?${ctx}`)
      else if (res.status === 'not_found') {
        if (confirm(`Produit ${code} introuvable dans Open Food Facts.\nVeux-tu le créer avec une photo du paquet et ses valeurs nutritionnelles ?`))
          navigate(`/nutrition/food/new?barcode=${code}&${ctx}`)
      } else alert(`Impossible de joindre Open Food Facts : ${res.message}`)
    },
    [ctx, navigate],
  )

  return (
    <Page title="Ajouter un aliment" subtitle={MEAL_LABELS[meal]} back>
      <div className="no-scrollbar -mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 pb-3">
        {MEALS.map((m) => (
          <Chip key={m} active={m === meal} onClick={() => setMeal(m)}>
            {MEAL_LABELS[m]}
          </Chip>
        ))}
      </div>
      <div className="relative">
        <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-silver" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (ex. skyr, poulet, Nutella…)"
          className={cn(inputClass, 'pl-10')}
          type="search"
          enterKeyHint="search"
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={() => setScan(true)} className="press flex flex-col items-center gap-1.5 rounded-2xl bg-gold py-3 text-xs font-semibold text-ink active:bg-gold-pale">
          <ScanBarcode size={22} /> Scanner
        </button>
        <button
          onClick={() => navigate(`/nutrition/food/new?${ctx}`)}
          className="press flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface py-3 text-xs font-medium text-ivory active:bg-raised"
        >
          <Camera size={22} className="text-gold" /> Créer (photo)
        </button>
        <button
          onClick={() => setQuick(true)}
          className="press flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface py-3 text-xs font-medium text-ivory active:bg-raised"
        >
          <Zap size={22} className="text-gold" /> Ajout rapide
        </button>
      </div>

      {scanStatus && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ivory-dim">
          <Loader2 size={16} className="animate-spin" /> {scanStatus}
        </p>
      )}

      {query.trim() ? (
        <>
          {local.length > 0 && (
            <>
              <SectionTitle>Mes aliments</SectionTitle>
              {local.map((f) => (
                <FoodRow key={f.id} food={f} onClick={() => openFood(f)} />
              ))}
            </>
          )}
          {genericShown.length > 0 && (
            <>
              <SectionTitle>Aliments génériques · Ciqual</SectionTitle>
              {genericShown.map((f) => (
                <FoodRow key={f.id} food={f} onClick={() => openFood(f)} />
              ))}
            </>
          )}
          <SectionTitle action={remote.loading && <Loader2 size={16} className="animate-spin text-silver" />}>Produits de marque</SectionTitle>
          {brands.map((f) => (
            <FoodRow key={f.barcode ?? f.id} food={f} onClick={() => openFood(f)} />
          ))}
          {remote.error && (
            <div className="mt-2 flex items-center gap-3 rounded-xl bg-raised/60 p-3 text-sm text-ivory-dim">
              <span className="flex-1">
                {brands.length ? 'Résultats hors ligne uniquement : ' : ''}
                {remote.error}.
              </span>
              <Button size="sm" variant="secondary" onClick={() => setRetry((n) => n + 1)}>
                Réessayer
              </Button>
            </div>
          )}
          {!remote.loading && !remote.error && query.trim().length >= 3 && brands.length === 0 && (
            <p className="text-sm text-silver">Aucun produit de marque trouvé. Essaie un autre mot-clé, scanne le code-barres ou crée l'aliment.</p>
          )}
          {remote.loading && brands.length === 0 && <p className="text-sm text-silver">Recherche en cours…</p>}
          {query.trim().length < 3 && brands.length === 0 && <p className="text-sm text-silver">Tape au moins 3 lettres…</p>}
        </>
      ) : (
        <>
          <div className="mt-4">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'recent', label: 'Récents' },
                { value: 'favorites', label: 'Favoris' },
                { value: 'meals', label: 'Repas' },
                { value: 'mine', label: 'Créés' },
              ]}
            />
          </div>
          {tab === 'meals' ? (
            <div className="mt-2">
              {(meals ?? []).map((m) => (
                <SavedMealRow
                  key={m.id}
                  meal={m}
                  onAdd={async () => {
                    await logSavedMeal(m, date, meal)
                    navigate(`/nutrition?date=${date}`)
                  }}
                />
              ))}
              {meals && meals.length === 0 && (
                <div className="mt-3">
                  <EmptyState title="Aucun repas favori">
                    Dans le journal, touche « ⋯ » sur un repas puis « Enregistrer comme repas favori » pour l'ajouter ici en un geste.
                  </EmptyState>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2">
              {tab === 'mine' && (
                <button
                  onClick={() => navigate(`/nutrition/recipe/new?${ctx}`)}
                  className="press mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-gold active:bg-raised"
                >
                  <div className="flex size-12 items-center justify-center rounded-xl bg-gold/12">
                    <ChefHat size={20} />
                  </div>
                  Nouvelle recette (ingrédients pesés, portions)
                </button>
              )}
              {local.map((f) => (
                <FoodRow key={f.id} food={f} onClick={() => openFood(f)} />
              ))}
              {foods && local.length === 0 && (
                <div className="mt-3">
                  <EmptyState title={tab === 'recent' ? 'Aucun aliment récent' : tab === 'favorites' ? 'Aucun favori' : 'Aucun aliment créé'}>
                    {tab === 'recent'
                      ? 'Scanne un code-barres ou recherche un aliment pour commencer.'
                      : tab === 'favorites'
                        ? "Touche l'étoile sur la fiche d'un aliment pour l'ajouter ici."
                        : 'Crée un aliment à partir de la photo de son emballage.'}
                  </EmptyState>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <BarcodeScanner open={scan} onClose={() => setScan(false)} onDetected={onDetected} />
      {quick && <QuickAdd date={date} meal={meal} onClose={() => setQuick(false)} onDone={() => navigate(`/nutrition?date=${date}`)} />}
    </Page>
  )
}

function SavedMealRow({ meal, onAdd }: { meal: SavedMeal; onAdd: () => void }) {
  const t = sumNutrients(meal.items.map((i) => i.nutrients))
  return (
    <div className="flex items-center gap-1 rounded-xl active:bg-raised">
      <button onClick={onAdd} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5 text-left">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
          <Star size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{meal.name}</div>
          <div className="truncate text-xs text-silver">
            {meal.items.length} aliment{meal.items.length > 1 ? 's' : ''} · {meal.items.map((i) => i.name).join(', ')}
          </div>
          <MacroLine {...t} />
        </div>
      </button>
      <IconButton
        aria-label={`Ajouter ${meal.name} à la liste de courses`}
        className="text-silver"
        onClick={async () => {
          await addToShopping(meal.items.filter((i) => i.quantity > 0).map((i) => ({ foodId: i.foodId, name: i.name, quantity: i.quantity, unit: i.unit })))
          alert(`Ingrédients de « ${meal.name} » ajoutés à la liste de courses.`)
        }}
      >
        <ShoppingCart size={16} />
      </IconButton>
      <IconButton
        aria-label={`Supprimer ${meal.name}`}
        className="text-silver"
        onClick={() => confirm(`Supprimer le repas favori « ${meal.name} » ?`) && void db.meals.delete(meal.id)}
      >
        <Trash2 size={16} />
      </IconButton>
    </div>
  )
}

function QuickAdd({ date, meal, onClose, onDone }: { date: string; meal: Meal; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState<number>()
  const [protein, setProtein] = useState<number>()
  const [carbs, setCarbs] = useState<number>()
  const [fat, setFat] = useState<number>()
  const computed = kcalFromMacros({ protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 })
  const finalKcal = kcal ?? Math.round(computed)
  const save = async () => {
    await db.entries.add({
      id: uid(),
      date,
      meal,
      name: name.trim() || 'Ajout rapide',
      quantity: 0,
      unit: 'g',
      nutrients: { kcal: finalKcal, protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 },
      createdAt: Date.now(),
    })
    onDone()
  }
  return (
    <Sheet open onClose={onClose} title={`Ajout rapide · ${MEAL_LABELS[meal]}`}>
      <div className="space-y-3">
        <Field label="Description (optionnel)">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Repas au resto" className={inputClass} />
        </Field>
        <Field label="Calories (kcal)" hint={kcal == null && computed > 0 ? `Calculé depuis les macros : ${Math.round(computed)} kcal` : undefined}>
          <NumberInput value={kcal} onChange={setKcal} decimals={false} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Protéines (g)">
            <NumberInput value={protein} onChange={setProtein} />
          </Field>
          <Field label="Glucides (g)">
            <NumberInput value={carbs} onChange={setCarbs} />
          </Field>
          <Field label="Lipides (g)">
            <NumberInput value={fat} onChange={setFat} />
          </Field>
        </div>
        <Button variant="primary" size="lg" className="w-full" disabled={!finalKcal} onClick={save}>
          <PenLine size={18} /> Ajouter {finalKcal ? `${finalKcal} kcal` : ''}
        </Button>
      </div>
    </Sheet>
  )
}
