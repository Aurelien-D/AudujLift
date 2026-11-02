import { Camera, ImagePlus, Loader2, Plus, ScanBarcode, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SolarSigil } from '../../components/SolarSigil'
import { Button, Card, Page, SectionTitle } from '../../components/ui'
import { decodeBarcodeFromImage } from '../../lib/barcode-image'
import { ensureFood, lookupBarcode } from '../../lib/foods'
import { compressImage } from '../../lib/image'
import { MEAL_LABELS } from '../../lib/nutrition'
import { searchProducts } from '../../lib/off'
import { searchPopularProducts } from '../../lib/offline-products'
import { aiKey } from '../../lib/plate-ai'
import { identifyProduct, productQueries, rankProductMatches, type ProductIdentity } from '../../lib/product-ai'
import type { Food, Meal } from '../../lib/types'
import { cn, normalize, toISODate } from '../../lib/utils'
import { defaultMeal, FoodRow } from './AddFood'
import { AiKeySetup } from './PlatePhoto'

type Result = { identity: ProductIdentity; matches: Food[]; offline: boolean; searching: boolean }

/** Fusionne sans doublon et classe ; le produit au code-barres lu sur la photo reste en tête. Les formats d'un
 *  même produit (pot de 400 g, 750 g, 1 kg) ont les mêmes valeurs pour 100 g : un seul est proposé. */
function merge(identity: ProductIdentity, pool: Food[]): Food[] {
  const seen = new Set<string>()
  const unique = pool.filter((f) => {
    const keys = [f.barcode ?? f.id, `${normalize(f.name)}|${normalize(f.brand ?? '')}|${Math.round(f.per100.kcal)}`]
    if (keys.some((k) => seen.has(k)) && f.barcode !== identity.barcode) return false
    keys.forEach((k) => seen.add(k))
    return true
  })
  const exact = identity.barcode ? unique.filter((f) => f.barcode === identity.barcode) : []
  return [
    ...exact,
    ...rankProductMatches(
      identity,
      unique.filter((f) => !exact.includes(f)),
    ),
  ].slice(0, 8)
}

/** Base hors ligne (instantanée) et code-barres lu par l'IA. */
async function localMatches(identity: ProductIdentity): Promise<Food[]> {
  const pool: Food[] = []
  if (identity.barcode) {
    const res = await lookupBarcode(identity.barcode)
    if (res.status === 'found') pool.push(res.food)
  }
  for (const q of productQueries(identity)) pool.push(...(await searchPopularProducts(q, 20)))
  return pool
}

/** Open Food Facts (peut être lent ou injoignable : n'empêche pas d'afficher les résultats hors ligne). */
async function onlineMatches(identity: ProductIdentity, signal: AbortSignal): Promise<{ pool: Food[]; offline: boolean }> {
  const pool: Food[] = []
  for (const q of productQueries(identity).slice(0, 2)) {
    try {
      pool.push(...(await searchProducts(q, signal)))
    } catch {
      return { pool, offline: true }
    }
  }
  return { pool, offline: false }
}

/** « Photo produit » : prendre le paquet en photo pour retrouver le produit dans la base. */
export default function ProductPhoto() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const date = params.get('date') ?? toISODate()
  const meal = (params.get('meal') as Meal) || defaultMeal()
  const ctx = `date=${date}&meal=${meal}`
  const [photo, setPhoto] = useState<string | null>(null)
  const [step, setStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needKey, setNeedKey] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => () => ctrl.current?.abort(), [])

  const openFood = async (food: Food) => {
    const saved = await ensureFood(food)
    navigate(`/nutrition/food/${saved.id}?${ctx}`, { replace: true })
  }

  const analyze = async (file: File) => {
    setError(null)
    setResult(null)
    setNeedKey(false)
    ctrl.current?.abort()
    const c = (ctrl.current = new AbortController())
    try {
      const img = await compressImage(file, 1092, 0.82)
      setPhoto(img)
      // 1. Code-barres visible sur la photo : gratuit, sans IA (photo en pleine résolution pour les petits codes)
      setStep('Recherche d’un code-barres…')
      const full = URL.createObjectURL(file)
      const code = await decodeBarcodeFromImage(full).finally(() => URL.revokeObjectURL(full))
      if (c.signal.aborted) return
      if (code) {
        setStep(`Code-barres ${code} : recherche du produit…`)
        const res = await lookupBarcode(code)
        if (res.status === 'found') return void (await openFood(res.food))
      }
      // 2. Sinon, l'IA lit l'emballage
      const key = aiKey()
      if (!key) {
        setStep(null)
        setNeedKey(true)
        return
      }
      setStep('Lecture de l’emballage…')
      const identity = await identifyProduct(img, key, c.signal)
      if (!identity.found) throw new Error(identity.note || 'Aucun produit reconnu : prends la face avant du paquet, bien cadrée et nette.')
      setStep(`Recherche de « ${[identity.brand, identity.name].filter(Boolean).join(' ')} »…`)
      const local = await localMatches(identity)
      if (c.signal.aborted) return
      setStep(null)
      setResult({ identity, matches: merge(identity, local), offline: false, searching: true })
      const online = await onlineMatches(identity, c.signal)
      if (c.signal.aborted) return
      setResult({ identity, matches: merge(identity, [...local, ...online.pool]), offline: online.offline, searching: false })
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message || 'Analyse impossible.')
    } finally {
      if (!c.signal.aborted) setStep(null)
    }
  }

  const createFromIdentity = (id: ProductIdentity) => {
    const q = new URLSearchParams({
      name: [id.name, id.variant].filter(Boolean).join(' '),
      brand: id.brand,
      ...(id.barcode ? { barcode: id.barcode } : {}),
      ...(id.labelRead ? { kcal: String(id.per100.kcal), protein: String(id.per100.protein), carbs: String(id.per100.carbs), fat: String(id.per100.fat) } : {}),
    })
    navigate(`/nutrition/food/new?${q}&${ctx}`, { replace: true })
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) void analyze(f)
  }
  const pickers = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={onPick} />
    </>
  )

  const id = result?.identity

  return (
    <Page back title="Photo du produit" subtitle={MEAL_LABELS[meal]}>
      {pickers}

      {photo && (
        <div className="relative overflow-hidden rounded-[18px] border border-line/70">
          <img src={photo} alt="Ton produit" className={cn('max-h-64 w-full object-contain transition', step && 'opacity-50 blur-[1px]')} />
          {step && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/40 px-4 text-center">
              <SolarSigil size={40} className="animate-spin text-gold [animation-duration:2.4s]" />
              <span className="rounded-full bg-ink/80 px-3 py-1.5 text-sm text-ivory">{step}</span>
            </div>
          )}
        </div>
      )}

      {!photo && (
        <Card glow className="flex flex-col items-center gap-4 py-8 text-center">
          <SolarSigil size={40} className="text-gold/80" />
          <div>
            <h2 className="text-lg font-semibold">Prends le produit en photo</h2>
            <p className="mt-1 text-sm text-silver">
              La face avant du paquet, bien cadrée et nette. Si le code-barres est visible, il est lu directement ; sinon l'IA lit la marque et le nom pour retrouver le produit
              dans la base.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="primary" size="lg" onClick={() => camera.current?.click()}>
              <Camera size={20} /> Photo
            </Button>
            <Button variant="secondary" size="lg" onClick={() => gallery.current?.click()}>
              <ImagePlus size={20} /> Galerie
            </Button>
          </div>
        </Card>
      )}

      {step && (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => (ctrl.current?.abort(), setStep(null))}>
          Annuler
        </Button>
      )}

      {needKey && (
        <Card className="mt-3">
          <p className="mb-3 text-sm text-ivory">Aucun code-barres lisible sur cette photo.</p>
          <p className="mb-4 text-sm text-silver">
            Pour reconnaître le produit sans code-barres, l'appli utilise l'IA (environ 1 centime la photo). Sinon, scanne le code-barres ou cherche le produit par son nom.
          </p>
          <div className="mb-4 flex items-center gap-2 text-gold">
            <Sparkles size={18} />
            <span className="font-semibold">Activer la reconnaissance par IA</span>
          </div>
          <AiKeySetup
            onSaved={() => {
              setNeedKey(false)
              camera.current?.click()
            }}
          />
          <Button variant="tertiary" className="mt-2 w-full" onClick={() => navigate(`/nutrition/add?${ctx}&scan=1`, { replace: true })}>
            <ScanBarcode size={18} /> Scanner le code-barres
          </Button>
        </Card>
      )}

      {error && (
        <Card className="mt-3 border-danger/40">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      )}

      {id && result && (
        <>
          <Card className="mt-3">
            <div className="label text-gold">Produit lu sur la photo</div>
            <div className="mt-1 font-semibold text-ivory">{[id.name, id.variant].filter(Boolean).join(' · ') || '—'}</div>
            <div className="text-sm text-silver">{[id.brand, id.quantity].filter(Boolean).join(' · ')}</div>
            {id.labelRead && (
              <div className="mt-1 text-xs text-silver">
                Étiquette : {Math.round(id.per100.kcal)} kcal · P {id.per100.protein} · G {id.per100.carbs} · L {id.per100.fat} /100 g
              </div>
            )}
            {id.note && <p className="mt-2 text-xs text-silver-dim">{id.note}</p>}
          </Card>

          <SectionTitle>{result.matches.length ? 'Choisis le bon produit' : result.searching ? 'Recherche dans Open Food Facts…' : 'Pas trouvé dans la base'}</SectionTitle>
          {result.matches.length > 0 ? (
            <Card className="p-1">
              {result.matches.map((f, i) => (
                <div key={f.barcode ?? f.id} className={cn(i === 0 && 'rounded-xl bg-gold/8')}>
                  <FoodRow food={f} onClick={() => openFood(f)} />
                </div>
              ))}
            </Card>
          ) : result.searching ? null : (
            <p className="text-sm text-silver">
              Ce produit n'est ni dans la base hors ligne ni dans Open Food Facts{result.offline ? ' (pas de connexion pour chercher en ligne)' : ''}.
            </p>
          )}
          {result.searching && result.matches.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-silver">
              <Loader2 size={12} className="animate-spin" /> Recherche en cours dans Open Food Facts…
            </p>
          )}
          {result.offline && result.matches.length > 0 && <p className="mt-2 text-xs text-silver-dim">Sans connexion : seuls les produits de la base hors ligne sont proposés.</p>}

          <Button variant={result.matches.length ? 'tertiary' : 'primary'} className="mt-3 w-full" onClick={() => createFromIdentity(id)}>
            <Plus size={18} /> {result.matches.length ? 'Aucun ne correspond : créer ce produit' : 'Créer ce produit'}
          </Button>
        </>
      )}

      {photo && !step && (
        <Button variant="secondary" className="mt-2 w-full" onClick={() => camera.current?.click()}>
          <Camera size={18} /> Reprendre une photo
        </Button>
      )}
    </Page>
  )
}
