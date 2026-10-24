import { db } from './db'

const TABLES = ['exercises', 'routines', 'workouts', 'foods', 'entries', 'days', 'bodyweights', 'settings', 'meals', 'measurements', 'photos'] as const

export async function exportBackup(): Promise<Blob> {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  const payload = { app: 'AudujLift', version: 1, exportedAt: new Date().toISOString(), data }
  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

export async function importBackup(file: File) {
  const payload = JSON.parse(await file.text())
  if (payload?.app !== 'AudujLift' || typeof payload.data !== 'object') throw new Error("Ce fichier n'est pas une sauvegarde AudujLift")
  await db.transaction(
    'rw',
    TABLES.map((t) => db.table(t)),
    async () => {
      for (const t of TABLES) {
        const rows = payload.data[t]
        if (!Array.isArray(rows)) continue
        await db.table(t).clear()
        await db.table(t).bulkPut(rows)
      }
    },
  )
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
