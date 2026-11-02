// Reconnaissance d'un produit emballé sur une photo : Claude lit la marque, le nom et, s'il est visible, le
// tableau nutritionnel ; l'appli cherche ensuite le produit dans la base hors ligne et dans Open Food Facts.
import { askVision } from './plate-ai'
import type { Food, Nutrients } from './types'
import { normalize } from './utils'

export interface ProductIdentity {
  found: boolean
  brand: string
  name: string
  /** Saveur, variante, version allégée… */
  variant: string
  /** Contenance imprimée (« 500 g », « 1 L ») */
  quantity: string
  /** Code-barres lu en entier sur la photo, sinon chaîne vide */
  barcode: string
  /** Valeurs pour 100 g / 100 ml : lues sur l'étiquette si `labelRead`, sinon valeurs typiques */
  per100: Pick<Nutrients, 'kcal' | 'protein' | 'carbs' | 'fat'>
  labelRead: boolean
  note: string
}

const NUM = { type: 'number' } as const
const STR = { type: 'string' } as const

export const PRODUCT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'brand', 'product_name', 'variant', 'quantity', 'barcode', 'label_read', 'kcal_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g', 'note'],
  properties: {
    found: { type: 'boolean' },
    brand: STR,
    product_name: STR,
    variant: STR,
    quantity: STR,
    barcode: STR,
    label_read: { type: 'boolean' },
    kcal_per_100g: NUM,
    protein_per_100g: NUM,
    carbs_per_100g: NUM,
    fat_per_100g: NUM,
    note: STR,
  },
}

const SYSTEM = `On te montre la photo d'un produit alimentaire emballé (paquet, bouteille, pot, barre…) prise dans une appli française de suivi nutritionnel. Le but est de retrouver ce produit dans Open Food Facts.

Recopie les textes tels qu'ils sont imprimés, sans les traduire :
- brand : la marque (« Danone », « Carrefour Bio », « Ferrero »). Chaîne vide si illisible.
- product_name : le nom commercial du produit, sans la marque (« Skyr nature », « Nutella », « Pain de mie complet »).
- variant : la saveur ou la version si elle est indiquée (« fraise », « 0 % », « sans sucres ajoutés »), sinon chaîne vide.
- quantity : la contenance imprimée (« 450 g », « 1,5 L »), sinon chaîne vide.
- barcode : les chiffres du code-barres seulement s'ils sont entièrement lisibles (8 ou 13 chiffres), sinon chaîne vide. N'invente jamais de chiffres.
- label_read : true si le tableau des valeurs nutritionnelles est lisible sur la photo. Dans ce cas, recopie ses valeurs pour 100 g ou 100 ml (énergie en kcal, protéines, glucides, lipides). Sinon false, et donne des valeurs typiques pour ce produit.
- found : false si la photo ne montre pas de produit alimentaire emballé ou si rien n'est lisible.
- note : une phrase courte en français sur ce qui est incertain, ou chaîne vide.`

const clamp = (n: unknown, max: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0)
const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '')

/** Valide et borne la réponse JSON du modèle. */
export function parseProductResponse(text: string): ProductIdentity {
  const raw = JSON.parse(text) as Record<string, unknown>
  const barcode = clean(raw.barcode).replace(/\s/g, '')
  return {
    found: raw.found === true && !!(clean(raw.product_name) || clean(raw.brand)),
    brand: clean(raw.brand),
    name: clean(raw.product_name),
    variant: clean(raw.variant),
    quantity: clean(raw.quantity),
    barcode: /^\d{8}$|^\d{12,14}$/.test(barcode) ? barcode : '',
    per100: { kcal: clamp(raw.kcal_per_100g, 950), protein: clamp(raw.protein_per_100g, 100), carbs: clamp(raw.carbs_per_100g, 100), fat: clamp(raw.fat_per_100g, 100) },
    labelRead: raw.label_read === true,
    note: clean(raw.note),
  }
}

/** Envoie la photo du paquet à Claude (effort bas : lecture de texte, pas de raisonnement long). */
export async function identifyProduct(dataUrl: string, apiKey: string, signal?: AbortSignal): Promise<ProductIdentity> {
  return parseProductResponse(await askVision(dataUrl, apiKey, { system: SYSTEM, schema: PRODUCT_SCHEMA, prompt: 'Quel est ce produit ?', effort: 'low' }, signal))
}

/** Requêtes de recherche, de la plus précise à la plus large. */
export function productQueries(id: ProductIdentity): string[] {
  const q = [
    [id.brand, id.name, id.variant],
    [id.brand, id.name],
    [id.name, id.variant],
  ].map((parts) => parts.filter(Boolean).join(' ').trim())
  return [...new Set(q.filter((s) => s.length >= 3))]
}

const words = (s: string) =>
  normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1)

/**
 * Classe les produits trouvés : la marque compte beaucoup (deux « skyr » de marques différentes n'ont pas les
 * mêmes valeurs), puis les mots du nom et de la variante ; si l'étiquette a été lue, des calories très
 * différentes écartent le produit.
 */
export function rankProductMatches(id: ProductIdentity, foods: Food[]): Food[] {
  const brand = words(id.brand)
  const name = words(`${id.name} ${id.variant}`)
  const score = (f: Food) => {
    const fBrand = words(f.brand ?? '')
    const fText = new Set(words(`${f.name} ${f.brand ?? ''}`))
    const brandHit = brand.length ? brand.filter((w) => fBrand.includes(w) || fText.has(w)).length / brand.length : 0
    const nameHit = name.length ? name.filter((w) => fText.has(w)).length / name.length : 0
    let s = brandHit * 2 + nameHit * 3
    if (id.labelRead && id.per100.kcal > 0 && f.per100.kcal > 0) {
      const gap = Math.abs(f.per100.kcal - id.per100.kcal) / Math.max(id.per100.kcal, 30)
      s += gap < 0.08 ? 1.5 : gap < 0.2 ? 0.5 : -1.5
    }
    return s
  }
  return foods
    .map((f, i) => ({ f, i, s: score(f) }))
    .filter((x) => x.s > 0.5)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f)
}
