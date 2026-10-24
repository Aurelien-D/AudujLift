import { describe, expect, it } from 'vitest'
import { parseNutritionLabel } from './labelParser'

describe('lecture d’étiquette', () => {
  it('lit un tableau nutritionnel français', () => {
    const text = `Valeurs nutritionnelles moyennes Pour 100 g Par portion (15 g)
Énergie 2252 kJ / 539 kcal 338 kJ / 81 kcal
Matières grasses 30,9 g 4,6 g
dont acides gras saturés 10,6 g 1,6 g
Glucides 57,5 g 8,6 g
dont sucres 56,3 g 8,4 g
Fibres alimentaires 0 g 0 g
Protéines 6,3 g 0,9 g
Sel 0,107 g 0,016 g`
    expect(parseNutritionLabel(text)).toEqual({ kcal: 539, fat: 30.9, saturatedFat: 10.6, carbs: 57.5, sugar: 56.3, fiber: 0, protein: 6.3, salt: 0.107 })
  })
  it('lit une étiquette anglaise et convertit les kJ', () => {
    const v = parseNutritionLabel(`Energy 1500 kJ\nFat 12.5g\nof which saturates 3g\nCarbohydrate 40g\nof which sugars 5g\nProtein 20g\nSalt 1.2g`)
    expect(v.kcal).toBe(359)
    expect(v.fat).toBe(12.5)
    expect(v.carbs).toBe(40)
    expect(v.protein).toBe(20)
  })
  it('corrige la confusion « g » / « 9 » de l’OCR', () => {
    const v = parseNutritionLabel('Énergie 1590 kJ / 377 kcal\nMatieres grasses 7,09\ndont acides gras saturés 1,29\nGlucides 58 g\nProtéines 13g\nSel 0,02 g')
    expect(v).toMatchObject({ kcal: 377, fat: 7.0, saturatedFat: 1.2, carbs: 58, protein: 13, salt: 0.02 })
  })
  it('corrige les valeurs impossibles (virgule perdue)', () => {
    const v = parseNutritionLabel('Énergie 377 kcal\nMatieres grasses 7\ndont acides gras saturés 129\nGlucides 589\ndont sucres 119\nProtéines 13')
    expect(v).toMatchObject({ kcal: 377, fat: 7, saturatedFat: 1.2, carbs: 58, sugar: 1.1, protein: 13 })
  })
  it('renvoie un objet vide sur du texte sans valeurs', () => {
    expect(parseNutritionLabel('Ingrédients : sucre, huile de palme')).toEqual({})
  })
})
