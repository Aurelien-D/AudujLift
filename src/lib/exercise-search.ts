import { EQUIPMENT_LABELS, MUSCLE_LABELS } from './exercises-data'
import type { Equipment, Exercise, MuscleGroup } from './types'
import { normalize } from './utils'

/**
 * Filtre et trie : tous les mots recherchés doivent apparaître (nom, muscle ou équipement) ;
 * les exercices perso et de la sélection de base passent devant le reste de la bibliothèque.
 */
export function filterExercises(list: Exercise[], query: string, muscle: MuscleGroup | 'all', equipment: Equipment | 'all' = 'all') {
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean)
  const scored: { e: Exercise; s: number }[] = []
  for (const e of list) {
    if (muscle !== 'all' && e.muscle !== muscle && !e.secondary.includes(muscle)) continue
    if (equipment !== 'all' && e.equipment !== equipment) continue
    const name = normalize(e.name)
    const text = `${name} ${normalize(MUSCLE_LABELS[e.muscle])} ${normalize(EQUIPMENT_LABELS[e.equipment])}`
    if (!words.every((w) => text.includes(w))) continue
    let s = e.custom || e.core ? 10 : 0
    if (words.length && name.startsWith(words[0])) s += 5
    if (words.length && words.every((w) => name.includes(w))) s += 3
    scored.push({ e, s })
  }
  return scored.sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name, 'fr')).map((x) => x.e)
}
