import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, EmptyState, IconButton, inputClass, Page, SectionTitle } from '../../components/ui'
import { db } from '../../lib/db'
import { formatQuantity } from '../../lib/kitchen'
import { addToShopping } from '../../lib/shopping'
import type { ShoppingItem } from '../../lib/types'
import { cn } from '../../lib/utils'

function Row({ item }: { item: ShoppingItem }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <button
        role="checkbox"
        aria-checked={item.checked}
        aria-label={item.name}
        onClick={() => db.shopping.update(item.id, { checked: !item.checked })}
        className={cn('press flex size-7 shrink-0 items-center justify-center rounded-lg border', item.checked ? 'border-gold bg-gold text-ink' : 'border-line bg-ink')}
      >
        {item.checked && <Check size={16} strokeWidth={3} />}
      </button>
      <span className={cn('min-w-0 flex-1 truncate text-sm', item.checked ? 'text-silver-dim line-through' : 'text-ivory')}>{item.name}</span>
      <span className={cn('shrink-0 text-sm', item.checked ? 'text-silver-dim' : 'text-gold')}>{formatQuantity(item.quantity, item.unit)}</span>
      <IconButton aria-label={`Retirer ${item.name}`} className="text-silver" onClick={() => db.shopping.delete(item.id)}>
        <Trash2 size={15} />
      </IconButton>
    </li>
  )
}

export default function ShoppingList() {
  const items = useLiveQuery(() => db.shopping.orderBy('createdAt').toArray(), [])
  const [text, setText] = useState('')
  const todo = (items ?? []).filter((i) => !i.checked).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const done = (items ?? []).filter((i) => i.checked)

  const add = async () => {
    const name = text.trim()
    if (!name) return
    await addToShopping([{ name }])
    setText('')
  }

  return (
    <Page back title="Liste de courses">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter un article (ex. citrons)" className={inputClass} enterKeyHint="done" />
        <Button variant="primary" type="submit" disabled={!text.trim()} aria-label="Ajouter">
          <Plus size={20} />
        </Button>
      </form>

      {items && items.length === 0 && (
        <div className="mt-6">
          <EmptyState icon={<ShoppingCart size={36} className="text-gold/70" />} title="Liste vide">
            Ajoute les ingrédients d'une recette ou d'un repas favori en un geste, ou note un article ci-dessus.
          </EmptyState>
        </div>
      )}

      {todo.length > 0 && (
        <>
          <SectionTitle>À acheter ({todo.length})</SectionTitle>
          <Card className="p-0">
            <ul className="divide-y divide-line/50">
              {todo.map((i) => (
                <Row key={i.id} item={i} />
              ))}
            </ul>
          </Card>
        </>
      )}

      {done.length > 0 && (
        <>
          <SectionTitle
            action={
              <Button variant="tertiary" size="sm" onClick={() => db.shopping.bulkDelete(done.map((i) => i.id))}>
                Retirer
              </Button>
            }
          >
            Dans le panier ({done.length})
          </SectionTitle>
          <Card className="p-0">
            <ul className="divide-y divide-line/50">
              {done.map((i) => (
                <Row key={i.id} item={i} />
              ))}
            </ul>
          </Card>
        </>
      )}

      {items && items.length > 0 && (
        <Button variant="ghost" className="mt-4 w-full" onClick={() => confirm('Vider toute la liste ?') && void db.shopping.clear()}>
          Vider la liste
        </Button>
      )}
    </Page>
  )
}
