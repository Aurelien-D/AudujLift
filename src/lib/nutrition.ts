import type { Activity, Food, Goal, Meal, Nutrients, Sex } from './types'

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collations',
}

export const MEALS: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner']

export const ACTIVITY_LABELS: Record<Activity, { label: string; factor: number; hint: string }> = {
  sedentary: { label: 'Sédentaire', factor: 1.2, hint: 'Bureau, peu de marche' },
  light: { label: 'Légèrement actif', factor: 1.375, hint: '1–3 séances / semaine' },
  moderate: { label: 'Modérément actif', factor: 1.55, hint: '3–5 séances / semaine' },
  active: { label: 'Très actif', factor: 1.725, hint: '6–7 séances / semaine' },
  very_active: { label: 'Extrêmement actif', factor: 1.9, hint: 'Travail physique + sport' },
}

export const GOAL_LABELS: Record<Goal, { label: string; delta: number }> = {
  cut: { label: 'Sèche (−15 %)', delta: -0.15 },
  maintain: { label: 'Maintien', delta: 0 },
  bulk: { label: 'Prise de masse (+10 %)', delta: 0.1 },
}

export const EMPTY_NUTRIENTS: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

/** Métabolisme de base — Mifflin-St Jeor */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export interface MacroGoals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export function suggestGoals(p: { sex: Sex; weightKg: number; heightCm: number; age: number; activity: Activity; goal: Goal }): MacroGoals & { tdee: number; bmr: number } {
  const b = bmr(p.sex, p.weightKg, p.heightCm, p.age)
  const tdee = b * ACTIVITY_LABELS[p.activity].factor
  const kcal = Math.round((tdee * (1 + GOAL_LABELS[p.goal].delta)) / 10) * 10
  // Protéines 2 g/kg en sèche, 1,8 g/kg sinon ; lipides ~0,9 g/kg ; le reste en glucides
  const protein = Math.round(p.weightKg * (p.goal === 'cut' ? 2.0 : 1.8))
  const fat = Math.round(p.weightKg * 0.9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat, tdee: Math.round(tdee), bmr: Math.round(b) }
}

export function scaleNutrients(per100: Nutrients, quantity: number): Nutrients {
  const f = quantity / 100
  const out: Nutrients = {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
  }
  if (per100.sugar != null) out.sugar = per100.sugar * f
  if (per100.fiber != null) out.fiber = per100.fiber * f
  if (per100.saturatedFat != null) out.saturatedFat = per100.saturatedFat * f
  if (per100.salt != null) out.salt = per100.salt * f
  return out
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, saturatedFat: 0, salt: 0 }
  for (const n of list) {
    out.kcal += n.kcal
    out.protein += n.protein
    out.carbs += n.carbs
    out.fat += n.fat
    out.sugar! += n.sugar ?? 0
    out.fiber! += n.fiber ?? 0
    out.saturatedFat! += n.saturatedFat ?? 0
    out.salt! += n.salt ?? 0
  }
  return out
}

/** Calories déduites des macros (utile pour vérifier une saisie) */
export const kcalFromMacros = (n: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>) => n.protein * 4 + n.carbs * 4 + n.fat * 9

export function defaultQuantity(food: Food): number {
  return food.servingSize ?? 100
}
