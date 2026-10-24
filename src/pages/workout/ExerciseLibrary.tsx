import { Plus, Search, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EquipmentSelect, ExerciseForm, ExerciseRow, MuscleChips, PAGE } from '../../components/ExercisePicker'
import { filterExercises } from '../../lib/exercise-search'
import { Button, Chip, IconButton, inputClass, Page } from '../../components/ui'
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
  const [mine, setMine] = useState(false)

  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of workouts ?? []) for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1)
    return m
  }, [workouts])
  const list = useMemo(
    () =>
      filterExercises(
        (all ?? []).filter((e) => !mine || e.custom),
        query,
        muscle,
        equipment,
      ),
    [all, query, muscle, equipment, mine],
  )
  const customCount = (all ?? []).filter((e) => e.custom).length

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
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-silver" />
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
      <div className="mb-1 flex items-center gap-2">
        <Chip active={mine} onClick={() => setMine(!mine)}>
          <span className="flex items-center gap-1">
            <User size={13} /> Mes exercices ({customCount})
          </span>
        </Chip>
      </div>
      <button onClick={() => setCreating(true)} className="press mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-gold active:bg-raised">
        <div className="flex size-11 items-center justify-center rounded-xl bg-gold/12">
          <Plus size={20} />
        </div>
        <div>
          <div className="font-medium">Créer un exercice</div>
          <div className="text-xs text-silver">Une machine de ta salle, une variante, un exercice maison…</div>
        </div>
      </button>
      <div className="mt-1">
        {list.slice(0, limit).map((e) => (
          <ExerciseRow
            key={e.id}
            exercise={e}
            onClick={() => navigate(`/exercises/${e.id}`)}
            right={usage.get(e.id) ? <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-silver">{usage.get(e.id)}×</span> : null}
          />
        ))}
      </div>
      {list.length > limit && (
        <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
          Afficher plus ({list.length - limit} restants)
        </Button>
      )}
      {list.length === 0 && (
        <p className="py-8 text-center text-sm text-silver">
          {mine && !customCount ? 'Tu n’as pas encore créé d’exercice.' : 'Aucun exercice trouvé.'}{' '}
          <button onClick={() => setCreating(true)} className="text-gold underline">
            {query.trim() ? `Créer « ${query.trim()} »` : 'En créer un'}
          </button>
        </p>
      )}
      {creating && <ExerciseForm open initialName={query} onClose={() => setCreating(false)} onSaved={(e) => navigate(`/exercises/${e.id}`)} />}
    </Page>
  )
}
