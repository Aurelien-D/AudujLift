import { Check } from 'lucide-react'
import type { Exercise } from '../lib/types'
import { normalizeSupersets } from '../lib/workout'
import { ExerciseThumb } from './ExercisePicker'
import { SortableList } from './SortableList'
import { Button, Sheet } from './ui'
import { supersetColor } from './workout-parts'

type Item = { uid: string; exerciseId: string; sets: unknown[]; supersetId?: string }

/** Feuille « Réorganiser » : liste compacte des exercices, à remettre dans l'ordre en les faisant glisser
 *  (les cartes complètes, avec leurs séries, sont trop hautes pour être déplacées confortablement). */
export function ReorderExercises<T extends Item>({
  exercises,
  exMap,
  onReorder,
  onClose,
}: {
  exercises: T[]
  exMap: Map<string, Exercise>
  onReorder: (list: T[]) => void
  onClose: () => void
}) {
  const all = exercises.map((e) => e.supersetId)
  return (
    <Sheet open onClose={onClose} title="Réorganiser les exercices">
      <p className="mb-3 text-xs text-silver">Fais glisser la poignée ⠿ pour changer l'ordre. Un exercice déplacé hors de son superset en sort.</p>
      <SortableList
        className="space-y-2"
        items={exercises}
        keyOf={(e) => e.uid}
        labelOf={(e) => exMap.get(e.exerciseId)?.name ?? 'Exercice'}
        onReorder={(list) => onReorder(normalizeSupersets(list))}
        renderItem={(e, handle) => {
          const ex = exMap.get(e.exerciseId)
          const color = supersetColor(e.supersetId, all)
          return (
            <div
              className="flex items-center gap-2 rounded-2xl border border-line/70 bg-raised/60 py-1.5 pr-3 pl-1"
              style={color ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined}
            >
              {handle}
              {ex && <ExerciseThumb exercise={ex} />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ivory">{ex?.name ?? 'Exercice supprimé'}</div>
                <div className="text-xs text-silver">
                  {e.sets.length} série{e.sets.length > 1 ? 's' : ''}
                  {color && (
                    <span className="ml-1.5 font-semibold" style={{ color }}>
                      · Superset
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        }}
      />
      <Button variant="primary" size="lg" className="mt-4 w-full" onClick={onClose}>
        <Check size={18} /> Terminé
      </Button>
    </Sheet>
  )
}
