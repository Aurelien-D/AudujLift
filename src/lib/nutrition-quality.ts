// Contrôles de cohérence des valeurs nutritionnelles : les fiches Open Food Facts sont saisies par des bénévoles et
// contiennent parfois des erreurs (kcal tapées à la place des kJ, colonnes inversées…) ; la saisie manuelle aussi.
import type { Nutrients } from './types'

/** Sel = sodium × 2,5 (le sodium représente environ 40 % du sel, NaCl). */
export const SALT_PER_SODIUM = 2.5

/** Énergie déduite des macros (fibres comptées 2 kcal/g, comme sur les étiquettes européennes). */
export const kcalFromNutrients = (n: Pick<Nutrients, 'protein' | 'carbs' | 'fat' | 'fiber'>) => 4 * n.protein + 4 * n.carbs + 9 * n.fat + 2 * (n.fiber ?? 0)

/**
 * Énergie d'une fiche qui donne à la fois kcal et kJ : quand les deux se contredisent (erreur de saisie fréquente,
 * ex. 375 kcal annoncées pour 3 060 kJ sur un beurre), on garde celle qui s'accorde avec les macros.
 */
export function reconcileEnergy(kcal: number | undefined, kj: number | undefined, macros: Pick<Nutrients, 'protein' | 'carbs' | 'fat' | 'fiber'>): number | undefined {
  const fromKj = kj != null ? kj / 4.184 : undefined
  if (kcal == null || fromKj == null) return kcal ?? fromKj
  if (Math.abs(kcal - fromKj) <= Math.max(5, 0.1 * Math.max(kcal, fromKj))) return kcal
  const calc = kcalFromNutrients(macros)
  return Math.abs(kcal - calc) <= Math.abs(fromKj - calc) ? kcal : fromKj
}

// L'alcool (7 kcal/g) et les polyols des produits « sans sucres » (2,4 kcal/g) ne figurent pas dans les macros :
// leurs calories s'écartent normalement du calcul.
const ENERGY_EXCEPTIONS =
  /\b(bi[eè]re|vin|vins|champagne|cidre|whisky|vodka|rhum|gin|liqueur|pastis|ap[eé]ritif|cocktail|porto|cognac|alcool|sans sucres?|sugar.?free|chewing.?gum|polyols?|[eé]dulcorant)\b/i

/** Incohérences d'une fiche (pour 100 g ou 100 ml), en français ; liste vide si tout est plausible. */
export function nutritionIssues(n: Nutrients, name = ''): string[] {
  const out: string[] = []
  if (n.sugar != null && n.sugar > n.carbs + 0.5) out.push(`plus de sucres (${round(n.sugar)} g) que de glucides (${round(n.carbs)} g)`)
  if (n.saturatedFat != null && n.saturatedFat > n.fat + 0.5) out.push(`plus de graisses saturées (${round(n.saturatedFat)} g) que de lipides (${round(n.fat)} g)`)
  if (n.protein + n.carbs + n.fat > 101) out.push(`plus de 100 g de protéines, glucides et lipides pour 100 g`)
  if (n.salt != null && n.salt > 100) out.push(`plus de 100 g de sel pour 100 g (${round(n.salt)} g)`)
  const calc = kcalFromNutrients(n)
  if (!ENERGY_EXCEPTIONS.test(name) && Math.abs(calc - n.kcal) > Math.max(40, 0.25 * Math.max(calc, n.kcal)))
    out.push(`${Math.round(n.kcal)} kcal annoncées, alors que les macros en donnent environ ${Math.round(calc)}`)
  return out
}

const round = (x: number) => Math.round(x * 10) / 10
