import { describe, expect, it } from 'vitest'
import { parseNutritionLabel } from './labelParser'
import { nutritionIssues, reconcileEnergy } from './nutrition-quality'
import { offNutrients } from './off'

describe('sel et sodium', () => {
  it('Open Food Facts : le sel est repris tel quel', () => {
    expect(offNutrients({ 'energy-kcal_100g': 250, proteins_100g: 9, carbohydrates_100g: 45, fat_100g: 3, salt_100g: 1.1, sodium_100g: 0.44 })?.salt).toBe(1.1)
  })
  it('Open Food Facts : sodium seul converti en sel (× 2,5)', () => {
    expect(offNutrients({ 'energy-kcal_100g': 250, proteins_100g: 9, carbohydrates_100g: 45, fat_100g: 3, sodium_100g: 0.4 })?.salt).toBeCloseTo(1)
  })
  it('étiquette : ligne « Sel » lue directement, même avec le sodium à côté', () => {
    expect(parseNutritionLabel('Valeurs pour 100 g\nÉnergie 1046 kJ / 250 kcal\nSel 1,2 g\nSodium 0,48 g').salt).toBe(1.2)
  })
  it('étiquette : sodium seul en grammes ou en milligrammes converti en sel', () => {
    expect(parseNutritionLabel('Energy 250 kcal\nSodium 0,4 g').salt).toBe(1)
    expect(parseNutritionLabel('Energy 250 kcal\nSodium 400 mg').salt).toBe(1)
  })
  it('étiquette : « sels minéraux » n’est pas du sel', () => {
    expect(parseNutritionLabel('Energie 50 kcal\nSels minéraux 2 g').salt).toBeUndefined()
  })
})

describe('cohérence des valeurs', () => {
  const butter = { protein: 0.7, carbs: 0.8, fat: 82, fiber: 0 }
  it('kcal contredites par les kJ : la valeur cohérente avec les macros l’emporte', () => {
    expect(reconcileEnergy(375, 3060, butter)).toBeCloseTo(731, 0) // beurre : 375 kcal saisies par erreur
    expect(reconcileEnergy(50.4, 420, { protein: 3.1, carbs: 3.5, fat: 7.9 })).toBeCloseTo(100, 0) // yaourt grec
    expect(reconcileEnergy(539, 2252, { protein: 6.3, carbs: 57.5, fat: 30.9 })).toBe(539) // cohérent : inchangé
    expect(reconcileEnergy(undefined, 1046, butter)).toBeCloseTo(250, 0)
  })
  it('signale les fiches impossibles', () => {
    expect(nutritionIssues({ kcal: 19, protein: 0, carbs: 0, fat: 0, sugar: 11 })[0]).toMatch(/plus de sucres/)
    expect(nutritionIssues({ kcal: 504, protein: 8.3, carbs: 62, fat: 0, saturatedFat: 15 }).join()).toMatch(/graisses saturées/)
    expect(nutritionIssues({ kcal: 0, protein: 0, carbs: 0, fat: 0, salt: 250 }).join()).toMatch(/100 g de sel/)
    expect(nutritionIssues({ kcal: 375, protein: 0.7, carbs: 0.8, fat: 82 }).join()).toMatch(/375 kcal annoncées/)
  })
  it('pas de fausse alerte : fiche juste, alcool, produits sans sucres', () => {
    expect(nutritionIssues({ kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, sugar: 56.3, saturatedFat: 10.6, salt: 0.11 })).toEqual([])
    expect(nutritionIssues({ kcal: 43, protein: 0.5, carbs: 3.5, fat: 0 }, 'Bière blonde')).toEqual([])
    expect(nutritionIssues({ kcal: 206, protein: 0.2, carbs: 76, fat: 0.3 }, 'Chewing-gum sans sucres')).toEqual([])
  })
})

describe('correction prudente des calories', () => {
  it('kcal hautes mais possibles (macros et kJ saisis pour une portion) : gardées', () => {
    // Muesli : 437 kcal justes ; macros et kJ saisis pour 50 g
    expect(reconcileEnergy(437, 916, { protein: 5, carbs: 30, fat: 7, fiber: 3 })).toBe(437)
  })
  it('kcal impossibles : corrigées avec les kJ', () => {
    // Fromage frais 8 % : 765 kcal impossibles avec 20 g de nutriments pour 100 g
    expect(reconcileEnergy(765, 552, { protein: 8, carbs: 4, fat: 8 })).toBeCloseTo(132, 0)
  })
  it('kJ qui ne collent pas non plus avec les macros : kcal de la fiche gardées', () => {
    expect(reconcileEnergy(300, 3000, { protein: 10, carbs: 50, fat: 5 })).toBe(300)
  })
})
