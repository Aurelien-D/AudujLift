// Recettes, liste de courses et qualité nutritionnelle de la journée.
import { EMPTY_NUTRIENTS, scaleNutrients, sumNutrients } from './nutrition'
import type { Food, FoodEntry, Nutrients, RecipeIngredient, ShoppingItem } from './types'
import { normalize, uid } from './utils'

// ---------- Recettes ----------

export interface RecipeNutrition {
  /** Poids de référence (cuit si renseigné, sinon cru) */
  weight: number
  totals: Nutrients
  per100: Nutrients
  perPortion: Nutrients
  portionWeight: number
}

/** Valeurs d'une recette : total des ingrédients, ramené à 100 g du plat (cuit si le poids cuit est connu). */
export function recipeNutrition(ingredients: RecipeIngredient[], portions: number, cookedWeight?: number): RecipeNutrition {
  const totals = sumNutrients(ingredients.map((i) => scaleNutrients(i.per100, i.quantity)))
  const raw = ingredients.reduce((w, i) => w + i.quantity, 0)
  const weight = cookedWeight && cookedWeight > 0 ? cookedWeight : raw
  const per100 = weight > 0 ? scaleNutrients(totals, 10000 / weight) : { ...EMPTY_NUTRIENTS }
  const n = Math.max(1, portions)
  // scaleNutrients(x, q) = x × q/100 : diviser par n revient à q = 100/n
  return { weight, totals, per100, perPortion: scaleNutrients(totals, 100 / n), portionWeight: weight / n }
}

/** Ingrédient à partir d'un aliment. */
export function ingredientFrom(food: Food, quantity: number): RecipeIngredient {
  return { foodId: food.id, name: food.name, brand: food.brand, quantity, unit: food.unit, per100: food.per100 }
}

// ---------- Liste de courses ----------

export const shoppingKey = (x: { foodId?: string; name: string }) => x.foodId ?? `name:${normalize(x.name.trim())}`

/**
 * Ajoute des articles à la liste : un article déjà présent et non coché voit sa quantité augmenter,
 * sinon une nouvelle ligne est créée. Renvoie les lignes à enregistrer.
 */
export function mergeShopping(existing: ShoppingItem[], additions: { foodId?: string; name: string; quantity?: number; unit?: 'g' | 'ml' }[], now = Date.now()): ShoppingItem[] {
  const out = new Map<string, ShoppingItem>()
  for (const a of additions) {
    const key = shoppingKey(a)
    const cur = out.get(key) ?? existing.find((e) => e.key === key && !e.checked)
    if (cur) {
      const sameUnit = !cur.unit || !a.unit || cur.unit === a.unit
      out.set(key, {
        ...cur,
        quantity: sameUnit && (cur.quantity != null || a.quantity != null) ? (cur.quantity ?? 0) + (a.quantity ?? 0) : cur.quantity,
        unit: cur.unit ?? a.unit,
      })
    } else out.set(key, { id: uid(), key, name: a.name.trim(), quantity: a.quantity, unit: a.unit, checked: false, createdAt: now })
  }
  return [...out.values()]
}

/** « 1,2 kg », « 350 g », « 75 cl » */
export function formatQuantity(q?: number, unit?: 'g' | 'ml'): string {
  if (!q) return ''
  const fr = (n: number) => (Math.round(n * 10) / 10).toLocaleString('fr-FR')
  if (unit === 'ml') return q >= 1000 ? `${fr(q / 1000)} L` : q >= 100 ? `${fr(q / 10)} cl` : `${fr(q)} ml`
  return q >= 1000 ? `${fr(q / 1000)} kg` : `${Math.round(q)} g`
}

// ---------- Qualité de la journée ----------

export interface QualityLine {
  key: 'fiber' | 'sugar' | 'saturatedFat' | 'salt'
  label: string
  value: number
  /** Repère : minimum conseillé (fibres) ou maximum conseillé (le reste) */
  ref: number
  kind: 'min' | 'max'
  /** Part des calories dont la valeur est connue (0–1) */
  coverage: number
}

export interface DayQuality {
  lines: QualityLine[]
  /** Nutri-Score moyen pondéré par les calories (A à E), si assez de produits notés */
  nutriscore?: string
  nutriscoreCoverage: number
}

const NS = ['a', 'b', 'c', 'd', 'e']

/**
 * Repères (adulte, ANSES/OMS) : fibres ≥ 30 g, sucres ≤ 10 % des calories, acides gras saturés ≤ 12 % des calories, sel ≤ 6 g.
 */
export function dayQuality(entries: FoodEntry[], foods: Map<string, Food>, kcalGoal: number): DayQuality {
  const kcalTotal = entries.reduce((s, e) => s + e.nutrients.kcal, 0) || 1
  const line = (key: QualityLine['key'], label: string, ref: number, kind: 'min' | 'max'): QualityLine => {
    const known = entries.filter((e) => e.nutrients[key] != null)
    return {
      key,
      label,
      value: known.reduce((s, e) => s + (e.nutrients[key] ?? 0), 0),
      ref,
      kind,
      coverage: known.reduce((s, e) => s + e.nutrients.kcal, 0) / kcalTotal,
    }
  }
  let nsKcal = 0
  let nsSum = 0
  for (const e of entries) {
    const g = e.foodId ? foods.get(e.foodId)?.nutriscore : undefined
    const i = g ? NS.indexOf(g.toLowerCase()) : -1
    if (i < 0) continue
    nsKcal += e.nutrients.kcal
    nsSum += i * e.nutrients.kcal
  }
  const nutriscoreCoverage = nsKcal / kcalTotal
  return {
    lines: [
      line('fiber', 'Fibres', 30, 'min'),
      line('sugar', 'Sucres', Math.round((kcalGoal * 0.1) / 4), 'max'),
      line('saturatedFat', 'Graisses saturées', Math.round((kcalGoal * 0.12) / 9), 'max'),
      line('salt', 'Sel', 6, 'max'),
    ],
    nutriscore: nsKcal > 0 && nutriscoreCoverage >= 0.3 ? NS[Math.round(nsSum / nsKcal)] : undefined,
    nutriscoreCoverage,
  }
}
