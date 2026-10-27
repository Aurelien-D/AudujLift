import { Minus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Chip, Field, inputClass, MacroLine, NumberInput, Sheet } from '../../components/ui'
import { db } from '../../lib/db'
import { MEAL_LABELS, MEALS, rescaleNutrients } from '../../lib/nutrition'
import type { FoodEntry, Meal } from '../../lib/types'

/** Modifier une entrée du journal sans fiche d'aliment : estimation de l'IA (on ajuste les grammes, les valeurs
 *  suivent en proportion) ou ajout rapide (on corrige directement calories et macros). */
export function EntryEditor({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const byWeight = entry.quantity > 0
  const [name, setName] = useState(entry.name)
  const [meal, setMeal] = useState<Meal>(entry.meal)
  const [grams, setGrams] = useState(entry.quantity)
  const [kcal, setKcal] = useState<number | undefined>(Math.round(entry.nutrients.kcal))
  const [protein, setProtein] = useState<number | undefined>(round1(entry.nutrients.protein))
  const [carbs, setCarbs] = useState<number | undefined>(round1(entry.nutrients.carbs))
  const [fat, setFat] = useState<number | undefined>(round1(entry.nutrients.fat))

  const nutrients = byWeight ? rescaleNutrients(entry.nutrients, entry.quantity, grams) : { kcal: kcal ?? 0, protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 }
  const valid = byWeight ? grams > 0 : nutrients.kcal > 0

  const save = async () => {
    await db.entries.update(entry.id, { name: name.trim() || entry.name, meal, nutrients, ...(byWeight ? { quantity: grams } : {}) })
    onClose()
  }
  const remove = async () => {
    if (!confirm(`Supprimer « ${entry.name} » ?`)) return
    await db.entries.delete(entry.id)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Modifier l'aliment">
      <div className="space-y-3">
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>

        {byWeight ? (
          <div>
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-silver">Quantité ({entry.unit})</span>
            <div className="flex items-center gap-2">
              <button aria-label="Moins 10" onClick={() => setGrams((g) => Math.max(0, g - 10))} className="press flex size-11 items-center justify-center rounded-xl bg-raised">
                <Minus size={18} />
              </button>
              <input
                aria-label={`Quantité de ${entry.name}`}
                inputMode="numeric"
                value={grams || ''}
                onChange={(e) => setGrams(Number(e.target.value.replace(/\D/g, '')) || 0)}
                className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-ink text-center text-lg font-semibold text-ivory"
              />
              <button aria-label="Plus 10" onClick={() => setGrams((g) => g + 10)} className="press flex size-11 items-center justify-center rounded-xl bg-raised">
                <Plus size={18} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <Field label="Calories (kcal)">
              <NumberInput value={kcal} onChange={setKcal} decimals={false} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Protéines (g)">
                <NumberInput value={protein} onChange={setProtein} />
              </Field>
              <Field label="Glucides (g)">
                <NumberInput value={carbs} onChange={setCarbs} />
              </Field>
              <Field label="Lipides (g)">
                <NumberInput value={fat} onChange={setFat} />
              </Field>
            </div>
          </>
        )}

        <div className="flex items-baseline justify-between rounded-xl bg-raised/60 px-3 py-2.5">
          <span className="font-display text-2xl font-semibold">
            {Math.round(nutrients.kcal)} <span className="text-sm font-normal text-silver">kcal</span>
          </span>
          <MacroLine kcal={nutrients.kcal} protein={nutrients.protein} carbs={nutrients.carbs} fat={nutrients.fat} />
        </div>

        {/* Pas de <Field> (label) autour de boutons : un clic sur l'intitulé déclencherait le premier */}
        <div role="group" aria-label="Repas">
          <span className="mb-1.5 block text-xs font-medium tracking-wide text-silver">Repas</span>
          <div className="flex flex-wrap gap-2">
            {MEALS.map((m) => (
              <Chip key={m} active={m === meal} onClick={() => setMeal(m)}>
                {MEAL_LABELS[m]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
          <Button variant="danger" aria-label="Supprimer" onClick={remove}>
            <Trash2 size={18} />
          </Button>
          <Button variant="primary" size="lg" disabled={!valid} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

const round1 = (x: number) => Math.round(x * 10) / 10
