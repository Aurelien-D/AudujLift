const DAY = 86400000
export const BACKUP_EVERY_DAYS = 14

/** Rappel de sauvegarde : des données de plus de 2 semaines et aucun export depuis 2 semaines. */
export function needsBackup(lastBackupAt: number | undefined, oldestData: number | undefined, now = Date.now()): boolean {
  if (!oldestData || now - oldestData < BACKUP_EVERY_DAYS * DAY) return false
  return !lastBackupAt || now - lastBackupAt > BACKUP_EVERY_DAYS * DAY
}
