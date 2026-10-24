import { describe, expect, it } from 'vitest'
import { estimateCostUsd, maskKey, parsePlateResponse, pickCandidate } from './plate-ai'

describe('analyse d’assiette', () => {
  it('lit et borne la réponse structurée', () => {
    const r = parsePlateResponse(
      JSON.stringify({
        items: [
          { name: 'Riz blanc', query: 'Riz blanc, cuit', grams: 182.4, confidence: 'high', kcal_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3 },
          { name: 'Huile', query: '', grams: 8, confidence: 'bizarre', kcal_per_100g: 9999, protein_per_100g: -1, carbs_per_100g: 0, fat_per_100g: 100 },
          { name: '', query: 'x', grams: 50, confidence: 'low', kcal_per_100g: 1, protein_per_100g: 1, carbs_per_100g: 1, fat_per_100g: 1 },
          { name: 'Rien', query: 'Rien', grams: 0, confidence: 'low', kcal_per_100g: 1, protein_per_100g: 1, carbs_per_100g: 1, fat_per_100g: 1 },
        ],
        note: ' Sauce difficile à estimer. ',
      }),
    )
    expect(r.items).toHaveLength(2)
    expect(r.items[0]).toMatchObject({ name: 'Riz blanc', query: 'Riz blanc, cuit', grams: 182, confidence: 'high' })
    expect(r.items[1]).toMatchObject({ query: 'Huile', confidence: 'medium', per100: { kcal: 950, protein: 0, fat: 100 } })
    expect(r.note).toBe('Sauce difficile à estimer.')
  })

  it('accepte une assiette vide (photo inexploitable)', () => {
    expect(parsePlateResponse('{"items":[],"note":"Pas de nourriture visible."}')).toEqual({ items: [], note: 'Pas de nourriture visible.' })
  })

  it('estime le coût (Opus 5.5 : 4 $ / 20 $ par million de tokens)', () => {
    expect(estimateCostUsd({ input_tokens: 2000, output_tokens: 1000 })).toBeCloseTo(0.028, 6)
  })

  it('masque la clé', () => {
    expect(maskKey('sk-ant-api03-abcdefghijklmnop1234')).toBe('sk-ant-…1234')
  })
})

describe('choix de l’aliment Ciqual', () => {
  const ai = { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }
  const jambon = { per100: { kcal: 105, protein: 20, carbs: 1, fat: 2.5 } }
  const filet = { per100: { kcal: 158, protein: 30, carbs: 0, fat: 4 } }
  it('écarte le premier résultat incohérent au profit d’un candidat cohérent', () => {
    expect(pickCandidate([jambon, filet], ai)).toBe(1)
  })
  it('garde le premier résultat quand il est cohérent', () => {
    expect(pickCandidate([filet, jambon], ai)).toBe(0)
  })
  it('repli sur l’estimation de l’IA si rien ne colle', () => {
    expect(pickCandidate([jambon], ai)).toBe(-1)
    expect(pickCandidate([], ai)).toBe(-1)
  })
})
