import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExerciseForm, ExerciseRow, filterExercises, MuscleChips } from '../../components/ExercisePicker'
import { IconButton, inputClass, Page } from '../../components/ui'
import { useDoneWorkouts, useExercises } from '../../lib/hooks'
import type { MuscleGroup } from '../../lib/types'
import { cn } from '../../lib/utils'

export default function ExerciseLibrary() {
  const navigate = useNavigate()
  const all = useExercises()
  const workouts = useDoneWorkouts()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [creating, setCreating] = useState(false)

  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of workouts ?? []) for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1)
    return m
  }, [workouts])
  const list = useMemo(() => filterExercises(all ?? [], query, muscle), [all, query, muscle])

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
      <div className="relative">
        <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className={cn(inputClass, 'pl-10')} />
      </div>
      <MuscleChips value={muscle} onChange={setMuscle} />
      <div className="mt-1">
        {list.map((e) => (
          <ExerciseRow
            key={e.id}
            exercise={e}
            onClick={() => navigate(`/exercises/${e.id}`)}
            right={usage.get(e.id) ? <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{usage.get(e.id)}×</span> : null}
          />
        ))}
      </div>
      {creating && <ExerciseForm open initialName={query} onClose={() => setCreating(false)} onSaved={(e) => navigate(`/exercises/${e.id}`)} />}
    </Page>
  )
}
