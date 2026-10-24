import { describe, expect, it } from 'vitest'
import { dayQuality, formatQuantity, mergeShopping, recipeNutrition } from './kitchen'
import type { Food, FoodEntry, RecipeIngredient } from './types'

const pasta: RecipeIngredient = { foodId: 'pates', name: 'Pâtes', quantity: 500, unit: 'g', per100: { kcal: 350, protein: 12, carbs: 70, fat: 1.5 } }
const beef: RecipeIngredient = { foodId: 'boeuf', name: 'Bœuf haché 5 %', quantity: 500, unit: 'g', per100: { kcal: 125, protein: 21, carbs: 0, fat: 5 } }

describe('recettes', () => {
  it('totalise et répartit par portion', () => {
    const r = recipeNutrition([pasta, beef], 4)
    expect(r.totals.kcal).toBe(2375)
    expect(r.perPortion.kcal).toBeCloseTo(593.75, 5)
    expect(r.portionWeight).toBe(250)
    expect(r.per100.kcal).toBeCloseTo(237.5, 5)
  })
  it('utilise le poids cuit pour les valeurs aux 100 g', () => {
    const r = recipeNutrition([pasta, beef], 4, 1900)
    expect(r.per100.kcal).toBeCloseTo(125, 5)
    expect(r.portionWeight).toBe(475)
    expect(r.perPortion.kcal).toBeCloseTo(593.75, 5)
  })
})

describe('liste de courses', () => {
  it('cumule les quantités du même aliment non coché', () => {
    const first = mergeShopping([], [{ foodId: 'pates', name: 'Pâtes', quantity: 500, unit: 'g' }], 1)
    const next = mergeShopping(first, [
      { foodId: 'pates', name: 'Pâtes', quantity: 250, unit: 'g' },
      { name: 'Citron', quantity: undefined },
    ])
    expect(next.find((x) => x.key === 'pates')).toMatchObject({ id: first[0].id, quantity: 750 })
    expect(next.find((x) => x.name === 'Citron')).toMatchObject({ key: 'name:citron', checked: false })
  })
  it('ne fusionne pas avec un article déjà coché', () => {
    const done = mergeShopping([], [{ foodId: 'pates', name: 'Pâtes', quantity: 500, unit: 'g' }]).map((x) => ({ ...x, checked: true }))
    const next = mergeShopping(done, [{ foodId: 'pates', name: 'Pâtes', quantity: 500, unit: 'g' }])
    expect(next[0].id).not.toBe(done[0].id)
  })
  it('affiche les quantités lisiblement', () => {
    expect(formatQuantity(1250, 'g')).toBe('1,3 kg')
    expect(formatQuantity(350, 'g')).toBe('350 g')
    expect(formatQuantity(750, 'ml')).toBe('75 cl')
    expect(formatQuantity(undefined)).toBe('')
  })
})

describe('qualité de la journée', () => {
  const e = (kcal: number, extra: Partial<FoodEntry['nutrients']>, foodId?: string): FoodEntry => ({
    id: String(kcal) + foodId,
    date: '2026-10-24',
    meal: 'lunch',
    foodId,
    name: 'x',
    quantity: 100,
    unit: 'g',
    nutrients: { kcal, protein: 0, carbs: 0, fat: 0, ...extra },
    createdAt: 0,
  })
  const food = (id: string, nutriscore: string) => ({ id, nutriscore }) as Food
  it('cumule les repères et mesure la part de données connues', () => {
    const q = dayQuality(
      [e(1000, { fiber: 12, salt: 2 }, 'a'), e(1000, { salt: 1.5 }, 'b')],
      new Map([
        ['a', food('a', 'a')],
        ['b', food('b', 'c')],
      ]),
      2500,
    )
    const fiber = q.lines.find((l) => l.key === 'fiber')!
    expect(fiber).toMatchObject({ value: 12, ref: 30, kind: 'min', coverage: 0.5 })
    expect(q.lines.find((l) => l.key === 'salt')).toMatchObject({ value: 3.5, coverage: 1 })
    expect(q.lines.find((l) => l.key === 'sugar')?.ref).toBe(63)
    expect(q.nutriscore).toBe('b')
  })
})
