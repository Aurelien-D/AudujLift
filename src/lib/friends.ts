import { db } from './db'
import { normalize, uid } from './utils'

/** Ajoute l'ami s'il est nouveau (même prénom = même ami) et compte l'échange. */
export async function recordFriend(name: string, kind: 'sent' | 'received') {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (!clean) return
  const now = Date.now()
  const all = await db.friends.toArray()
  const existing = all.find((f) => normalize(f.name) === normalize(clean))
  if (existing) await db.friends.update(existing.id, { [kind]: existing[kind] + 1, lastAt: now })
  else await db.friends.add({ id: uid(), name: clean, received: kind === 'received' ? 1 : 0, sent: kind === 'sent' ? 1 : 0, lastAt: now, createdAt: now })
}
