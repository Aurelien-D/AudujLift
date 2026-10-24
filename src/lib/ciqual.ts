// Aliments génériques de la table Ciqual 2025 (ANSES, licence CC-BY 4.0), embarqués dans l'appli :
// la recherche fonctionne instantanément et hors connexion. Données générées par scripts/ciqual2json.py.
import type { Food, Nutrients } from './types'
import { normalize } from './utils'

/** [code, nom, kcal, protéines, glucides, lipides, sucres, fibres, AG saturés, sel] pour 100 g */
export type CiqualRow = [number, string, number, number, number, number, number | null, number | null, number | null, number | null]

interface Indexed {
  row: CiqualRow
  name: string
  words: string[]
}

let index: Promise<Indexed[]> | undefined

function loadIndex(): Promise<Indexed[]> {
  index ??= import('../data/ciqual.json').then((m) =>
    (m.default as CiqualRow[]).map((row) => {
      const name = normalize(row[1])
      return { row, name, words: name.split(/[^a-z0-9]+/).filter(Boolean) }
    }),
  )
  return index
}

export function ciqualToFood(row: CiqualRow): Food {
  const [code, name, kcal, protein, carbs, fat, sugar, fiber, saturatedFat, salt] = row
  const per100: Nutrients = { kcal, protein, carbs, fat }
  if (sugar != null) per100.sugar = sugar
  if (fiber != null) per100.fiber = fiber
  if (saturatedFat != null) per100.saturatedFat = saturatedFat
  if (salt != null) per100.salt = salt
  return { id: `ciqual-${code}`, source: 'ciqual', name, per100, unit: 'g', createdAt: Date.now() }
}

/**
 * Score de pertinence (null si un mot manque) : chaque mot recherché doit commencer un mot du nom ; on favorise le nom qui commence
 * par le premier mot, les aliments « crus / nature / aliment moyen » et les libellés courts.
 */
export function scoreName(query: string[], item: { name: string; words: string[] }): number | null {
  let score = 0
  for (const q of query) {
    const i = item.words.findIndex((w) => w.startsWith(q))
    if (i < 0) return null
    score += item.words[i] === q ? 4 : 2
    score -= i * 0.3
  }
  if (item.name.startsWith(query[0])) score += 4
  // Ciqual nomme « Aliment, précision » : « Banane, … » passe devant « Banane plantain, … »
  if (item.name.startsWith(`${query.join(' ')},`)) score += 1
  if (/\b(cru|crue|nature|aliment moyen)\b/.test(item.name)) score += 1.5
  // Libellés courts d'abord : « Oeuf cru » avant « Oeuf, blanc (blanc d'oeuf), cru »
  return score - (item.words.length - query.length) * 0.3 - item.name.length / 40
}

export async function searchCiqual(query: string, limit = 25): Promise<Food[]> {
  const words = normalize(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (!words.length) return []
  const items = await loadIndex()
  return items
    .map((it) => ({ it, s: scoreName(words, it) }))
    .filter((x): x is { it: Indexed; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => ciqualToFood(x.it.row))
}
