import { describe, expect, it } from 'vitest'
import { searchCiqual } from './ciqual'

describe('recherche Ciqual', () => {
  it('trouve les aliments de base en tête', async () => {
    expect((await searchCiqual('banane'))[0].name).toBe('Banane, chair sans peau, crue')
    expect((await searchCiqual('blanc de poulet')).length).toBeGreaterThan(0)
    const riz = await searchCiqual('riz cuit')
    expect(riz[0].name).toMatch(/^Riz.*cuit/)
  })
  it('ignore les accents et la casse', async () => {
    expect((await searchCiqual('PATES SECHES'))[0].name).toMatch(/^Pâtes sèches/)
  })
  it('convertit en aliment avec un identifiant stable', async () => {
    const [f] = await searchCiqual('lait demi ecreme uht')
    expect(f.id).toMatch(/^ciqual-\d+$/)
    expect(f.source).toBe('ciqual')
    expect(f.per100.protein).toBeGreaterThan(3)
  })
  it('ne renvoie rien si un mot ne correspond pas', async () => {
    expect(await searchCiqual('banane zzzz')).toEqual([])
  })
})
