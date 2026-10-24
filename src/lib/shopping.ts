import { db } from './db'
import { mergeShopping } from './kitchen'

/** Ajoute des articles à la liste de courses (fusion avec les articles identiques non cochés). */
export async function addToShopping(items: { foodId?: string; name: string; quantity?: number; unit?: 'g' | 'ml' }[]) {
  await db.transaction('rw', db.shopping, async () => {
    const existing = await db.shopping.toArray()
    await db.shopping.bulkPut(mergeShopping(existing, items))
  })
}
