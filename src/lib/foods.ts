import { db } from './db'
import { scaleNutrients } from './nutrition'
import { fetchProductByBarcode } from './off'
import { findPopularByBarcode } from './offline-products'
import type { Food, FoodEntry, Meal } from './types'
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
  await db.foods.update(food.id, { lastUsedAt: Date.now() })
}
