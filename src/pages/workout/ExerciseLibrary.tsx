import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EquipmentSelect, ExerciseForm, ExerciseRow, MuscleChips, PAGE } from '../../components/ExercisePicker'
import { filterExercises } from '../../lib/exercise-search'
import { Button, IconButton, inputClass, Page } from '../../components/ui'
import { useDoneWorkouts, useExercises } from '../../lib/hooks'
import type { Equipment, MuscleGroup } from '../../lib/types'
import { cn } from '../../lib/utils'

export default function ExerciseLibrary() {
  const navigate = useNavigate()
  const all = useExercises()
  const workouts = useDoneWorkouts()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all')
  const [limit, setLimit] = useState(PAGE)
  const [creating, setCreating] = useState(false)

  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of workouts ?? []) for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1)
    return m
  }, [workouts])
  const list = useMemo(() => filterExercises(all ?? [], query, muscle, equipment), [all, query, muscle, equipment])

  return (
    <Page
      title="Exercices"
      subtitle={`${all?.length ?? 0} exercices`}
      back
      actions={
        <IconButton aria-label="Créer" onClick={() => setCreating(true)}>
          <Plus size={22} />
        </IconButton>
      }
    >
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
            placeholder="Rechercher"
            className={cn(inputClass, 'pl-10')}
          />
        </div>
        <EquipmentSelect value={equipment} onChange={setEquipment} />
      </div>
      <MuscleChips value={muscle} onChange={setMuscle} />
      <div className="mt-1">
        {list.slice(0, limit).map((e) => (
          <ExerciseRow
            key={e.id}
            exercise={e}
            onClick={() => navigate(`/exercises/${e.id}`)}
            right={usage.get(e.id) ? <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{usage.get(e.id)}×</span> : null}
          />
        ))}
      </div>
      {list.length > limit && (
        <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
          Afficher plus ({list.length - limit} restants)
        </Button>
      )}
      {list.length === 0 && <p className="py-8 text-center text-sm text-zinc-400">Aucun exercice trouvé.</p>}
      {creating && <ExerciseForm open initialName={query} onClose={() => setCreating(false)} onSaved={(e) => navigate(`/exercises/${e.id}`)} />}
    </Page>
  )
}
