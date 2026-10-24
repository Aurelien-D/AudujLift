import { db } from './db'
import { scaleNutrients } from './nutrition'
import { fetchProductByBarcode } from './off'
import { findPopularByBarcode } from './offline-products'
import type { Food, FoodEntry, Meal, SavedMeal } from './types'
import { uid } from './utils'

/** Enregistre un aliment issu d'Open Food Facts s'il n'est pas déjà en base (dédoublonné par code-barres). */
export async function ensureFood(food: Food): Promise<Food> {
  if (food.barcode) {
    const existing = await db.foods.where('barcode').equals(food.barcode).first()
    if (existing) return existing
  } else {
    const existing = await db.foods.get(food.id)
    if (existing) return existing
  }
  await db.foods.add(food)
  return food
}

export type BarcodeLookup = { status: 'found'; food: Food } | { status: 'not_found' } | { status: 'error'; message: string }

/** Cherche d'abord dans les aliments locaux, puis parmi les produits populaires embarqués, puis dans Open Food Facts. */
export async function lookupBarcode(barcode: string): Promise<BarcodeLookup> {
  const local = await db.foods.where('barcode').equals(barcode).first()
  if (local) return { status: 'found', food: local }
  const popular = await findPopularByBarcode(barcode)
  if (popular) return { status: 'found', food: await ensureFood(popular) }
  try {
    const food = await fetchProductByBarcode(barcode)
    if (!food) return { status: 'not_found' }
    return { status: 'found', food: await ensureFood(food) }
  } catch (e) {
    return { status: 'error', message: (e as Error).message || 'Connexion impossible' }
  }
}

export async function logFood(food: Food, quantity: number, date: string, meal: Meal, entryId?: string) {
  const entry: FoodEntry = {
    id: entryId ?? uid(),
    date,
    meal,
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    quantity,
    unit: food.unit,
    nutrients: scaleNutrients(food.per100, quantity),
    createdAt: Date.now(),
  }
  if (entryId) {
    const prev = await db.entries.get(entryId)
    if (prev) entry.createdAt = prev.createdAt
  }
  await db.entries.put(entry)
  await db.foods.update(food.id, quantity > 0 ? { lastUsedAt: Date.now(), lastQuantity: quantity } : { lastUsedAt: Date.now() })
}

/** Ajoute tous les aliments d'un repas favori au journal. */
export async function logSavedMeal(saved: SavedMeal, date: string, meal: Meal) {
  const now = Date.now()
  await db.entries.bulkAdd(saved.items.map((it, i) => ({ ...it, id: uid(), date, meal, createdAt: now + i })))
  await db.meals.update(saved.id, { lastUsedAt: now })
}

/** Enregistre les aliments d'un repas du journal comme repas favori. */
export async function saveMealFromEntries(name: string, entries: FoodEntry[]): Promise<SavedMeal> {
  const saved: SavedMeal = {
    id: uid(),
    name,
    items: entries.map(({ foodId, name, brand, quantity, unit, nutrients }) => ({ foodId, name, brand, quantity, unit, nutrients })),
    createdAt: Date.now(),
  }
  await db.meals.add(saved)
  return saved
}
