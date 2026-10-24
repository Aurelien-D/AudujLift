import { describe, expect, it } from 'vitest'
import { applyFolderOrder, moveItem, sortRoutines } from './routine-order'
import type { Routine } from './types'

const r = (id: string, extra: Partial<Routine> = {}): Routine => ({ id, name: id, exercises: [], createdAt: 0, updatedAt: 0, ...extra })

describe('ordre des routines', () => {
  it('sans rang : les plus récemment modifiées en tête (comportement historique)', () => {
    expect(sortRoutines([r('a', { updatedAt: 1 }), r('b', { updatedAt: 3 }), r('c', { updatedAt: 2 })]).map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('avec rang : ordre choisi, modifier une routine ne la fait plus remonter', () => {
    expect(sortRoutines([r('a', { order: 2, updatedAt: 99 }), r('b', { order: 0 }), r('c', { order: 1 })]).map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('une nouvelle routine (sans rang) arrive en tête des routines rangées', () => {
    expect(sortRoutines([r('a', { order: 0 }), r('neuve', { updatedAt: 5 }), r('b', { order: 1 })]).map((x) => x.id)).toEqual(['neuve', 'a', 'b'])
  })

  it('déplace un élément vers le bas et vers le haut', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('réordonner un dossier garde la place des autres dossiers', () => {
    // Liste globale : P1, X, P2, P3 (P = dossier PPL, X = autre dossier)
    const sorted = [r('P1'), r('X'), r('P2'), r('P3')]
    expect(applyFolderOrder(sorted, ['P3', 'P1', 'P2'])).toEqual(['P3', 'X', 'P1', 'P2'])
  })
})
