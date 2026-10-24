import { Check, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { db } from '../lib/db'
import { EQUIPMENT_LABELS, exerciseImages, KIND_LABELS, MUSCLE_LABELS } from '../lib/exercises-data'
import { useExercises } from '../lib/hooks'
import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '../lib/types'
import { filterExercises } from '../lib/exercise-search'
import { cn, uid } from '../lib/utils'
import { Button, Chip, Field, inputClass, Select, Sheet } from './ui'

/** Nombre d'exercices affichés par page (la liste complète en compte ~900) */
export const PAGE = 120

export function EquipmentSelect({ value, onChange }: { value: Equipment | 'all'; onChange: (v: Equipment | 'all') => void }) {
  return (
    <div className="w-36 shrink-0">
      <Select
        value={value}
        onChange={onChange}
        className="py-2.5 pr-2 text-sm"
        options={[{ value: 'all' as const, label: 'Tout matériel' }, ...Object.entries(EQUIPMENT_LABELS).map(([v, label]) => ({ value: v as Equipment, label }))]}
      />
    </div>
  )
}

export function ExerciseThumb({ exercise, selected }: { exercise: Exercise; selected?: boolean }) {
  const [img] = exerciseImages(exercise)
  return (
    <div
      className={cn(
        'flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold',
        selected ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300',
      )}
    >
      {selected ? <Check size={20} /> : img ? <img src={img} alt="" loading="lazy" className="size-full object-cover" /> : exercise.name.charAt(0)}
    </div>
  )
}

export function MuscleChips({ value, onChange }: { value: MuscleGroup | 'all'; onChange: (m: MuscleGroup | 'all') => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2">
      <Chip active={value === 'all'} onClick={() => onChange('all')}>
        Tous
      </Chip>
      {(Object.keys(MUSCLE_LABELS) as MuscleGroup[]).map((m) => (
        <Chip key={m} active={value === m} onClick={() => onChange(m)}>
          {MUSCLE_LABELS[m]}
        </Chip>
      ))}
    </div>
  )
}

export function ExerciseRow({ exercise, selected, onClick, right }: { exercise: Exercise; selected?: boolean; onClick: () => void; right?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition active:bg-zinc-800', selected && 'bg-lime-400/10')}>
      <ExerciseThumb exercise={exercise} selected={selected} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{exercise.name}</div>
        <div className="truncate text-xs text-zinc-400">
          {MUSCLE_LABELS[exercise.muscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
          {exercise.custom && ' · Perso'}
        </div>
      </div>
      {right}
    </button>
  )
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
  multiple = true,
  title = 'Ajouter des exercices',
}: {
  open: boolean
  onClose: () => void
  onPick: (exercises: Exercise[]) => void
  multiple?: boolean
  title?: string
}) {
  const all = useExercises()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all')
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState<Exercise[]>([])
  const [creating, setCreating] = useState(false)
  const list = useMemo(() => filterExercises(all ?? [], query, muscle, equipment), [all, query, muscle, equipment])

  const close = () => {
    setSelected([])
    setQuery('')
    onClose()
  }
  const toggle = (e: Exercise) => {
    if (!multiple) {
      onPick([e])
      close()
      return
    }
    setSelected((s) => (s.some((x) => x.id === e.id) ? s.filter((x) => x.id !== e.id) : [...s, e]))
  }

  return (
    <Sheet open={open} onClose={close} title={title} full>
      <div className="sticky top-0 z-10 -mx-4 bg-zinc-900 px-4 pb-1">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(PAGE)
              }}
              placeholder={`Rechercher parmi ${all?.length ?? ''} exercices`}
              className={cn(inputClass, 'pl-10')}
            />
          </div>
          <EquipmentSelect value={equipment} onChange={setEquipment} />
        </div>
        <MuscleChips value={muscle} onChange={setMuscle} />
      </div>
      <button onClick={() => setCreating(true)} className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-lime-400 active:bg-zinc-800">
        <div className="flex size-10 items-center justify-center rounded-xl bg-lime-400/15">
          <Plus size={20} />
        </div>
        Créer un exercice personnalisé
      </button>
      {list.slice(0, limit).map((e) => (
        <ExerciseRow key={e.id} exercise={e} selected={selected.some((s) => s.id === e.id)} onClick={() => toggle(e)} />
      ))}
      {list.length > limit && (
        <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
          Afficher plus ({list.length - limit} restants)
        </Button>
      )}
      {list.length === 0 && <p className="py-8 text-center text-sm text-zinc-400">Aucun exercice trouvé.</p>}
      {multiple && selected.length > 0 && (
        <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-zinc-900 via-zinc-900 px-4 pt-6 pb-1">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => {
              onPick(selected)
              close()
            }}
          >
            Ajouter {selected.length} exercice{selected.length > 1 ? 's' : ''}
          </Button>
        </div>
      )}
      {creating && (
        <ExerciseForm
          open
          initialName={query}
          onClose={() => setCreating(false)}
          onSaved={(e) => {
            setCreating(false)
            toggle(e)
          }}
        />
      )}
    </Sheet>
  )
}

export function ExerciseForm({
  open,
  onClose,
  onSaved,
  initialName = '',
  exercise,
}: {
  open: boolean
  onClose: () => void
  onSaved?: (e: Exercise) => void
  initialName?: string
  exercise?: Exercise
}) {
  const [name, setName] = useState(exercise?.name ?? initialName)
  const [muscle, setMuscle] = useState<MuscleGroup>(exercise?.muscle ?? 'pectoraux')
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'halteres')
  const [kind, setKind] = useState<ExerciseKind>(exercise?.kind ?? 'weight_reps')
  const [notes, setNotes] = useState(exercise?.notes ?? '')

  const save = async () => {
    const e: Exercise = {
      ...(exercise ?? { secondary: [], custom: true }),
      id: exercise?.id ?? `custom-${uid()}`,
      name: name.trim(),
      muscle,
      equipment,
      kind,
      notes: notes.trim() || undefined,
    }
    await db.exercises.put(e)
    onSaved?.(e)
  }

  return (
    <Sheet open={open} onClose={onClose} title={exercise ? "Modifier l'exercice" : 'Nouvel exercice'}>
      <div className="space-y-3">
        <Field label="Nom">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Ex. Développé couché prise large" />
        </Field>
        <Field label="Muscle principal">
          <Select value={muscle} onChange={setMuscle} options={Object.entries(MUSCLE_LABELS).map(([value, label]) => ({ value: value as MuscleGroup, label }))} />
        </Field>
        <Field label="Équipement">
          <Select value={equipment} onChange={setEquipment} options={Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({ value: value as Equipment, label }))} />
        </Field>
        <Field label="Type de mesure">
          <Select value={kind} onChange={setKind} options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value: value as ExerciseKind, label }))} />
        </Field>
        <Field label="Notes (réglages machine, consignes…)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
        </Field>
        <Button variant="primary" size="lg" className="w-full" disabled={!name.trim()} onClick={save}>
          Enregistrer
        </Button>
      </div>
    </Sheet>
  )
}
