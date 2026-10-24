import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchProductByBarcode, offToFood, rankResults } from './off'
import type { Food } from './types'

describe('conversion Open Food Facts', () => {
  it('convertit un produit', () => {
    const f = offToFood({
      code: '3017620422003',
      product_name_fr: 'Nutella',
      brands: 'Nutella, Ferrero',
      quantity: '400 g',
      serving_quantity: '15',
      nutriscore_grade: 'e',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, sugars_100g: 56.3 },
    })!
    expect(f).toMatchObject({ name: 'Nutella', brand: 'Nutella', barcode: '3017620422003', unit: 'g', servingSize: 15, nutriscore: 'e', source: 'off' })
    expect(f.per100).toMatchObject({ kcal: 539, protein: 6.3, sugar: 56.3 })
  })
  it('déduit les kcal depuis les kJ et l’unité ml', () => {
    const f = offToFood({ product_name: 'Jus', quantity: '1 L', nutriments: { energy_100g: 184, carbohydrates_100g: 10 } })!
    expect(f.per100.kcal).toBeCloseTo(44, 0)
    expect(f.unit).toBe('ml')
  })
  it('ignore les produits sans nom ou sans valeurs', () => {
    expect(offToFood({ product_name: '', nutriments: { 'energy-kcal_100g': 10 } })).toBeUndefined()
    expect(offToFood({ product_name: 'X', nutriments: {} })).toBeUndefined()
  })
})

describe('classement des résultats', () => {
  const food = (name: string, brand?: string) => ({ id: name, name, brand, source: 'off', per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, unit: 'g', createdAt: 0 }) as Food
  it('place en tête les produits correspondant à la recherche', () => {
    const list = [food('Fromage blanc nature'), food('Skyr nature 0%', 'Yoplait'), food('Le petit suisse'), food('Skyr', 'Siggi’s')]
    expect(rankResults('skyr', list).map((f) => f.name)).toEqual(['Skyr nature 0%', 'Skyr', 'Fromage blanc nature', 'Le petit suisse'])
  })
})

describe('code-barres', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('un produit absent de la base (404) est « introuvable », pas une panne', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ code: '1002106824350', status: 0, status_verbose: 'product not found' }), { status: 404 }))
    await expect(fetchProductByBarcode('1002106824350')).resolves.toBeNull()
  })

  it('une vraie panne reste une erreur', async () => {
    vi.stubGlobal('fetch', async () => new Response('Service Unavailable', { status: 503 }))
    await expect(fetchProductByBarcode('3017620422003')).rejects.toThrow(/indisponible \(503\)/)
  })
})
