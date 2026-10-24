import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Loader2, PenLine, ScanBarcode, Search, Star, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarcodeScanner } from '../../components/BarcodeScanner'
import { Button, Chip, EmptyState, Field, inputClass, NumberInput, Page, SectionTitle, Sheet, Tabs } from '../../components/ui'
import { db } from '../../lib/db'
import { ensureFood, lookupBarcode } from '../../lib/foods'
import { kcalFromMacros, MEAL_LABELS, MEALS } from '../../lib/nutrition'
import { searchProducts } from '../../lib/off'
import type { Food, Meal } from '../../lib/types'
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
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-zinc-800">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-800">
        {img ? <img src={img} alt="" loading="lazy" className="size-full object-cover" /> : <span className="text-lg">🍴</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{food.name}</span>
          {food.favorite && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />}
        </div>
        <div className="truncate text-xs text-zinc-400">
          {food.brand ? `${food.brand} · ` : ''}
          {Math.round(food.per100.kcal)} kcal · P {Math.round(food.per100.protein)} · G {Math.round(food.per100.carbs)} · L {Math.round(food.per100.fat)}{' '}
          <span className="text-zinc-600">/100{food.unit}</span>
        </div>
      </div>
      <NutriScore grade={food.nutriscore} />
    </button>
  )
}

type Tab = 'recent' | 'favorites' | 'mine'

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

  const foods = useLiveQuery(() => db.foods.toArray(), [])
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

  // Recherche Open Food Facts (avec temporisation pendant la frappe)
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
  }, [query])

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
        <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500" />
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
        <button
          onClick={() => setScan(true)}
          className="flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-accent py-3 text-xs font-bold text-zinc-950 active:brightness-90"
        >
          <ScanBarcode size={22} /> Scanner
        </button>
        <button
          onClick={() => navigate(`/nutrition/food/new?${ctx}`)}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900 py-3 text-xs font-medium text-zinc-200 active:bg-zinc-800"
        >
          <Camera size={22} className="text-lime-400" /> Créer (photo)
        </button>
        <button
          onClick={() => setQuick(true)}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900 py-3 text-xs font-medium text-zinc-200 active:bg-zinc-800"
        >
          <Zap size={22} className="text-lime-400" /> Ajout rapide
        </button>
      </div>

      {scanStatus && (
        <p className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
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
          <SectionTitle action={remote.loading && <Loader2 size={16} className="animate-spin text-zinc-500" />}>Open Food Facts</SectionTitle>
          {remote.error && <p className="text-sm text-rose-400">{remote.error}. Réessaie dans un instant.</p>}
          {!remote.loading && !remote.error && query.trim().length >= 3 && remote.results.length === 0 && (
            <p className="text-sm text-zinc-500">Aucun résultat. Essaie un autre mot-clé ou crée l'aliment.</p>
          )}
          {query.trim().length < 3 && <p className="text-sm text-zinc-500">Tape au moins 3 lettres…</p>}
          {remote.results.map((f) => (
            <FoodRow key={f.barcode ?? f.id} food={f} onClick={() => openFood(f)} />
          ))}
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
                { value: 'mine', label: 'Créés' },
              ]}
            />
          </div>
          <div className="mt-2">
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
        </>
      )}

      <BarcodeScanner open={scan} onClose={() => setScan(false)} onDetected={onDetected} />
      {quick && <QuickAdd date={date} meal={meal} onClose={() => setQuick(false)} onDone={() => navigate(`/nutrition?date=${date}`)} />}
    </Page>
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
