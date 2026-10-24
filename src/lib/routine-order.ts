// Ordre des routines choisi par glisser-déposer dans l'écran Entraînement.
import type { Routine } from './types'

/** Ordre d'affichage : rang choisi par l'utilisateur ; les routines sans rang (nouvelles, importées, dupliquées)
 *  passent en tête, les plus récentes d'abord — comme avant l'ajout du glisser-déposer. */
export function sortRoutines(list: readonly Routine[]): Routine[] {
  return [...list].sort((a, b) => {
    if (a.order == null || b.order == null) return a.order == null && b.order == null ? b.updatedAt - a.updatedAt : a.order == null ? -1 : 1
    return a.order - b.order
  })
}

/** Déplace l'élément d'index `from` vers l'index `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Nouvel ordre complet après un réarrangement à l'intérieur d'un dossier : les routines du dossier
 *  reprennent leurs emplacements dans la liste globale (l'ordre des dossiers ne bouge pas). */
export function applyFolderOrder(sorted: readonly Routine[], folderIds: readonly string[]): string[] {
  const inFolder = new Set(folderIds)
  let i = 0
  return sorted.map((r) => (inFolder.has(r.id) ? folderIds[i++] : r.id))
}
