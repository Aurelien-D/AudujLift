import { describe, expect, it } from 'vitest'
import { bmr, rescaleNutrients, scaleNutrients, suggestGoals, sumNutrients } from './nutrition'

describe('besoins caloriques', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmr('male', 80, 180, 30)).toBe(1780)
    expect(bmr('female', 60, 165, 30)).toBeCloseTo(1320.25, 2)
  })
  it('propose des macros cohérentes avec les calories', () => {
    const g = suggestGoals({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activity: 'moderate', goal: 'maintain' })
    expect(g.tdee).toBe(2759)
    expect(g.protein).toBe(144)
    expect(Math.abs(g.protein * 4 + g.carbs * 4 + g.fat * 9 - g.kcal)).toBeLessThan(10)
  })
})

describe('calculs nutritionnels', () => {
  it('met à l’échelle pour une quantité', () => {
    const n = scaleNutrients({ kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, sugar: 56.3 }, 15)
    expect(n.kcal).toBeCloseTo(80.85)
    expect(n.sugar).toBeCloseTo(8.445)
    expect(n.fiber).toBeUndefined()
  })
  it('additionne', () => {
    const t = sumNutrients([
      { kcal: 100, protein: 10, carbs: 5, fat: 2 },
      { kcal: 50, protein: 1, carbs: 10, fat: 0, fiber: 3 },
    ])
    expect(t).toMatchObject({ kcal: 150, protein: 11, carbs: 15, fat: 2, fiber: 3 })
  })
})

describe('modifier la quantité d’une entrée', () => {
  it('les valeurs suivent la quantité en proportion', () => {
    const n = rescaleNutrients({ kcal: 300, protein: 20, carbs: 30, fat: 10, fiber: 4 }, 150, 200)
    expect(n.kcal).toBeCloseTo(400)
    expect(n.protein).toBeCloseTo(26.67, 1)
    expect(n.fiber).toBeCloseTo(5.33, 1)
  })
  it('sans quantité d’origine, rien ne change', () => {
    expect(rescaleNutrients({ kcal: 300, protein: 20, carbs: 30, fat: 10 }, 0, 200).kcal).toBe(300)
  })
})
