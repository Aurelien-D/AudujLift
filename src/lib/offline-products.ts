// Produits de marque les plus scannés en France (extrait d'Open Food Facts, licence ODbL), embarqués dans l'appli :
// recherche et scan instantanés, même hors connexion. Généré par scripts/off-popular.py.
import { scoreName } from './ciqual'
import type { Food, Nutrients } from './types'
import { normalize } from './utils'

/** [code, nom, marque, kcal, prot, gluc, lip, sucres, fibres, AGS, sel, portion, unité, nutriscore, image] */
export type OffRow = [
  string,
  string,
  string,
  number,
  number,
  number,
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  'g' | 'ml',
  string | null,
  string | null,
]

interface Indexed {
  row: OffRow
  rank: number
  name: string
  words: string[]
}

let index: Promise<{ items: Indexed[]; byCode: Map<string, OffRow> }> | undefined

function load() {
  index ??= import('../data/off-fr.json').then((m) => {
    const rows = m.default as OffRow[]
    const items = rows.map((row, rank) => {
      const name = normalize(`${row[1]} ${row[2]}`)
      return { row, rank, name, words: name.split(/[^a-z0-9]+/).filter(Boolean) }
    })
    return { items, byCode: new Map(rows.map((r) => [r[0], r])) }
  })
  return index
}

/** URL de la photo de face sur le serveur d'images d'Open Food Facts */
export function offImageUrl(code: string, image: string | null): string | undefined {
  if (!image) return undefined
  const path = code.length > 8 ? code.padStart(13, '0').replace(/^(\d{3})(\d{3})(\d{3})(\d+)$/, '$1/$2/$3/$4') : code
  return `https://images.openfoodfacts.org/images/products/${path}/${image}.200.jpg`
}

export function offRowToFood(row: OffRow): Food {
  const [code, name, brand, kcal, protein, carbs, fat, sugar, fiber, saturatedFat, salt, serving, unit, nutriscore, image] = row
  const per100: Nutrients = { kcal, protein, carbs, fat }
  if (sugar != null) per100.sugar = sugar
  if (fiber != null) per100.fiber = fiber
  if (saturatedFat != null) per100.saturatedFat = saturatedFat
  if (salt != null) per100.salt = salt
  return {
    id: `off-${code}`,
    source: 'off',
    barcode: code,
    name,
    brand: brand || undefined,
    imageUrl: offImageUrl(code, image),
    per100,
    unit,
    servingSize: serving ?? undefined,
    nutriscore: nutriscore ?? undefined,
    createdAt: Date.now(),
  }
}

/** Recherche par nom et marque ; à pertinence égale, les produits les plus scannés passent devant. */
export async function searchPopularProducts(query: string, limit = 30): Promise<Food[]> {
  const words = normalize(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (!words.length) return []
  const { items } = await load()
  return items
    .map((it) => ({ it, s: scoreName(words, it) }))
    .filter((x): x is { it: Indexed; s: number } => x.s !== null)
    .map((x) => ({ ...x, s: x.s - x.it.rank / 4000 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => offRowToFood(x.it.row))
}

export async function findPopularByBarcode(code: string): Promise<Food | null> {
  const { byCode } = await load()
  const row = byCode.get(code)
  return row ? offRowToFood(row) : null
}
