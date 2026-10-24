import { describe, expect, it } from 'vitest'
import { isValidBarcode, offFields } from './off-contribute'
import type { Food } from './types'

const food: Food = {
  id: 'x',
  source: 'custom',
  barcode: '1002106824350',
  name: ' Skyr nature ',
  brand: 'Ferme du Coin',
  per100: { kcal: 62, protein: 10.5, carbs: 3.8, fat: 0.2, salt: 0.1 },
  unit: 'g',
  servingSize: 150,
  createdAt: 0,
}

describe('contribution Open Food Facts', () => {
  it('prépare les champs du produit (pour 100 g)', () => {
    const f = offFields(food)
    expect(f).toMatchObject({
      code: '1002106824350',
      product_name_fr: 'Skyr nature',
      brands: 'Ferme du Coin',
      countries: 'France',
      serving_size: '150 g',
      nutrition_data_per: '100g',
      'nutriment_energy-kcal': '62',
      nutriment_proteins: '10.5',
      nutriment_proteins_unit: 'g',
      nutriment_salt: '0.1',
    })
    // Valeurs non renseignées : rien n'est envoyé (plutôt qu'un faux zéro)
    expect(f).not.toHaveProperty('nutriment_sugars')
    expect(f).not.toHaveProperty('nutriment_fiber_unit')
  })

  it('vérifie le code-barres', () => {
    expect(isValidBarcode('3017620422003')).toBe(true)
    expect(isValidBarcode('12345')).toBe(false)
    expect(isValidBarcode(undefined)).toBe(false)
  })
})
