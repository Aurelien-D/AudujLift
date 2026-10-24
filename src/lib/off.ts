// Client Open Food Facts — base collaborative et gratuite (très bonne couverture en France).
// Doc : https://openfoodfacts.github.io/openfoodfacts-server/api/
import type { Food, Nutrients } from './types'
import { normalize, uid } from './utils'

const FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'generic_name_fr',
  'brands',
  'image_front_small_url',
  'image_front_url',
  'serving_quantity',
  'serving_size',
  'quantity',
  'nutriscore_grade',
  'nutriments',
].join(',')

export interface OffProduct {
  code?: string
  product_name?: string
  product_name_fr?: string
  generic_name_fr?: string
  brands?: string | string[]
  image_front_small_url?: string
  image_front_url?: string
  serving_quantity?: number | string
  serving_size?: string
  quantity?: string
  nutriscore_grade?: string
  nutriments?: Record<string, number | string | undefined>
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

export function offNutrients(n: OffProduct['nutriments'] = {}): Nutrients | undefined {
  let kcal = num(n['energy-kcal_100g'])
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g'])
    if (kj != null) kcal = kj / 4.184
  }
  const protein = num(n['proteins_100g'])
  const carbs = num(n['carbohydrates_100g'])
  const fat = num(n['fat_100g'])
  if (kcal == null && protein == null && carbs == null && fat == null) return undefined
  const out: Nutrients = { kcal: kcal ?? 0, protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 }
  const sugar = num(n['sugars_100g'])
  const fiber = num(n['fiber_100g'])
  const sat = num(n['saturated-fat_100g'])
  const salt = num(n['salt_100g'])
  if (sugar != null) out.sugar = sugar
  if (fiber != null) out.fiber = fiber
  if (sat != null) out.saturatedFat = sat
  if (salt != null) out.salt = salt
  return out
}

export function offToFood(p: OffProduct): Food | undefined {
  const per100 = offNutrients(p.nutriments)
  const name = (p.product_name_fr || p.product_name || p.generic_name_fr || '').trim()
  if (!per100 || !name) return undefined
  const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0]?.trim()
  const unit = /\d\s*(ml|cl|l)\b/i.test(p.quantity ?? '') ? 'ml' : 'g'
  const serving = num(p.serving_quantity)
  return {
    id: uid(),
    source: 'off',
    barcode: p.code,
    name,
    brand: brand || undefined,
    imageUrl: p.image_front_small_url || p.image_front_url,
    per100,
    unit,
    servingSize: serving && serving > 0 ? serving : undefined,
    servingLabel: p.serving_size,
    nutriscore: p.nutriscore_grade && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : undefined,
    createdAt: Date.now(),
  }
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

/**
 * GET JSON avec nouvelles tentatives. Open Food Facts renvoie souvent 503 quand il est surchargé,
 * sans en-tête CORS : le navigateur ne voit alors qu'une erreur réseau. On retente donc aussi dans ce cas,
 * en alternant les serveurs proposés.
 */
async function getJson(urls: string | string[], signal?: AbortSignal, attempts = 1): Promise<any> {
  const list = Array.isArray(urls) ? urls : [urls]
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await wait(600 * 2 ** (i - 1), signal)
    try {
      const res = await fetch(list[i % list.length], { signal, headers: { Accept: 'application/json' } })
      if (res.ok) return await res.json()
      lastError = new Error(`Open Food Facts indisponible (${res.status})`)
      if (res.status < 500 && res.status !== 429) break
    } catch (e) {
      if (signal?.aborted) throw e
      lastError = e
    }
  }
  throw lastError instanceof Error && lastError.message !== 'Failed to fetch' && lastError.message !== 'Load failed'
    ? lastError
    : new Error('Open Food Facts ne répond pas (serveur surchargé)')
}

/** Remonte en tête les produits dont le nom ou la marque contient tous les mots recherchés. */
export function rankResults(query: string, foods: Food[]): Food[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const score = (f: Food) => {
    const name = normalize(f.name)
    const text = `${name} ${normalize(f.brand ?? '')}`
    const inName = words.filter((w) => name.includes(w)).length
    const inText = words.filter((w) => text.includes(w)).length
    return (inText === words.length ? 2 : 0) + inName / words.length
  }
  return foods
    .map((f, i) => ({ f, i, s: score(f) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f)
}

/** Cherche un produit par code-barres. Renvoie null s'il n'existe pas dans la base. */
export async function fetchProductByBarcode(barcode: string, signal?: AbortSignal): Promise<Food | null> {
  const data = await getJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}&lc=fr`, signal, 3)
  if (data.status !== 1 || !data.product) return null
  return offToFood({ code: barcode, ...data.product }) ?? null
}

/** Recherche plein texte, en priorité sur les produits vendus en France. */
export async function searchProducts(query: string, signal?: AbortSignal): Promise<Food[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '40',
    lc: 'fr',
    tagtype_0: 'countries',
    tag_contains_0: 'contains',
    tag_0: 'france',
    fields: FIELDS,
  })
  const data = await getJson([`https://fr.openfoodfacts.org/cgi/search.pl?${params}`, `https://world.openfoodfacts.org/cgi/search.pl?${params}`], signal, 5)
  const products: OffProduct[] = data.products ?? []
  return rankResults(
    query,
    products.map(offToFood).filter((f): f is Food => !!f),
  )
}
