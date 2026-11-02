import { describe, expect, it } from 'vitest'
import { parseProductResponse, productQueries, rankProductMatches, type ProductIdentity } from './product-ai'
import type { Food } from './types'

const food = (name: string, brand: string, kcal: number, barcode = name): Food => ({
  id: barcode,
  source: 'off',
  barcode,
  name,
  brand,
  per100: { kcal, protein: 10, carbs: 4, fat: 0.2 },
  unit: 'g',
  createdAt: 0,
})
const identity = (o: Partial<ProductIdentity> = {}): ProductIdentity => ({
  found: true,
  brand: 'Siggi’s',
  name: 'Skyr',
  variant: 'vanille',
  quantity: '450 g',
  barcode: '',
  per100: { kcal: 78, protein: 9.5, carbs: 9, fat: 0.4 },
  labelRead: false,
  note: '',
  ...o,
})

describe('reconnaissance de produit', () => {
  it('lit et borne la réponse structurée', () => {
    const r = parseProductResponse(
      JSON.stringify({
        found: true,
        brand: ' Danone ',
        product_name: 'Skyr nature',
        variant: '',
        quantity: '450 g',
        barcode: '3033 4900 04743',
        label_read: true,
        kcal_per_100g: 64,
        protein_per_100g: 11,
        carbs_per_100g: 4,
        fat_per_100g: -3,
        note: '',
      }),
    )
    expect(r).toMatchObject({ found: true, brand: 'Danone', name: 'Skyr nature', barcode: '3033490004743', labelRead: true, per100: { kcal: 64, fat: 0 } })
  })
  it('écarte un code-barres incomplet (jamais de chiffres inventés)', () => {
    const r = parseProductResponse(JSON.stringify({ found: true, brand: 'X', product_name: 'Y', barcode: '30334', label_read: false }))
    expect(r.barcode).toBe('')
  })
  it('photo sans produit lisible', () => {
    expect(parseProductResponse(JSON.stringify({ found: true, brand: '', product_name: '', note: 'Image floue' })).found).toBe(false)
  })
  it('requêtes de la plus précise à la plus large, sans doublon', () => {
    expect(productQueries(identity())).toEqual(['Siggi’s Skyr vanille', 'Siggi’s Skyr', 'Skyr vanille'])
    expect(productQueries(identity({ brand: '', variant: '' }))).toEqual(['Skyr'])
  })
  it('la bonne marque et la bonne variante passent devant', () => {
    const list = [food('Skyr nature', 'Danone', 64, 'a'), food('Skyr vanille', 'Siggi’s', 80, 'b'), food('Skyr nature', 'Siggi’s', 65, 'c'), food('Yaourt', 'Autre', 90, 'd')]
    expect(rankProductMatches(identity(), list).map((f) => f.id)).toEqual(['b', 'c', 'a'])
  })
  it('étiquette lue : des calories très différentes font reculer le produit', () => {
    const list = [food('Skyr vanille', 'Siggi’s', 140, 'faux'), food('Skyr vanille', 'Siggi’s', 79, 'bon')]
    expect(rankProductMatches(identity({ labelRead: true }), list)[0].id).toBe('bon')
  })
})
