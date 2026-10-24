import { Camera, Check, Plus, Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { db } from '../lib/db'
import { EQUIPMENT_LABELS, exerciseImages, KIND_LABELS, MUSCLE_LABELS } from '../lib/exercises-data'
import { useExercises } from '../lib/hooks'
import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '../lib/types'
import { filterExercises } from '../lib/exercise-search'
import { compressImage } from '../lib/image'
import { cn, normalize, uid } from '../lib/utils'
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
      className={cn('flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold', selected ? 'bg-gold text-ink' : 'bg-raised text-ivory-dim')}
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
    <button onClick={onClick} className={cn('flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition active:bg-raised', selected && 'bg-gold/10')}>
      <ExerciseThumb exercise={exercise} selected={selected} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{exercise.name}</div>
        <div className="truncate text-xs text-silver">
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
      <div className="sticky top-0 z-10 -mx-4 bg-surface px-4 pb-1">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-silver" />
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
      <button onClick={() => setCreating(true)} className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-gold active:bg-raised">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gold/15">
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
      {list.length === 0 && <p className="py-8 text-center text-sm text-silver">Aucun exercice trouvé.</p>}
      {multiple && selected.length > 0 && (
        <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-surface via-surface px-4 pt-6 pb-1">
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
  duplicateOf,
}: {
  open: boolean
  onClose: () => void
  onSaved?: (e: Exercise) => void
  initialName?: string
  /** Exercice à modifier */
  exercise?: Exercise
  /** Exercice servant de modèle pour une variante personnelle */
  duplicateOf?: Exercise
}) {
  const base = exercise ?? duplicateOf
  const all = useExercises()
  const [name, setName] = useState(exercise?.name ?? (duplicateOf ? `${duplicateOf.name} (variante)` : initialName))
  const [muscle, setMuscle] = useState<MuscleGroup>(base?.muscle ?? 'pectoraux')
  const [secondary, setSecondary] = useState<MuscleGroup[]>(base?.secondary ?? [])
  const [equipment, setEquipment] = useState<Equipment>(base?.equipment ?? 'halteres')
  const [kind, setKind] = useState<ExerciseKind>(base?.kind ?? 'weight_reps')
  const [notes, setNotes] = useState(base?.notes ?? '')
  const [photo, setPhoto] = useState<string | undefined>(base?.photo)
  const fileRef = useRef<HTMLInputElement>(null)

  const trimmed = name.trim()
  const twin = trimmed && (all ?? []).find((e) => e.id !== exercise?.id && normalize(e.name) === normalize(trimmed))

  const toggleSecondary = (m: MuscleGroup) => setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))

  const save = async () => {
    const e: Exercise = {
      ...(exercise ?? { secondary: [], custom: true }),
      ...(duplicateOf ? { ref: duplicateOf.ref, guideId: duplicateOf.guideId ?? duplicateOf.id, standard: duplicateOf.standard, category: duplicateOf.category } : {}),
      id: exercise?.id ?? `custom-${uid()}`,
      name: trimmed,
      muscle,
      secondary: secondary.filter((m) => m !== muscle),
      equipment,
      kind,
      notes: notes.trim() || undefined,
      photo,
    }
    await db.exercises.put(e)
    onSaved?.(e)
  }

  return (
    <Sheet open={open} onClose={onClose} title={exercise ? "Modifier l'exercice" : duplicateOf ? 'Nouvelle variante' : 'Nouvel exercice'}>
      <div className="space-y-3">
        <Field label="Nom">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Ex. Presse à cuisses 45° (salle)" />
        </Field>
        {twin && <p className="-mt-1 text-xs text-warn">Un exercice porte déjà ce nom : « {twin.name} ».</p>}
        <Field label="Muscle principal">
          <Select value={muscle} onChange={setMuscle} options={Object.entries(MUSCLE_LABELS).map(([value, label]) => ({ value: value as MuscleGroup, label }))} />
        </Field>
        <div>
          <div className="mb-1.5 text-xs font-medium text-silver">Muscles secondaires (comptés pour moitié dans la carte des muscles)</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MUSCLE_LABELS) as MuscleGroup[])
              .filter((m) => m !== muscle && m !== 'cardio' && m !== 'corps-entier')
              .map((m) => (
                <Chip key={m} active={secondary.includes(m)} onClick={() => toggleSecondary(m)}>
                  {MUSCLE_LABELS[m]}
                </Chip>
              ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Équipement">
            <Select value={equipment} onChange={setEquipment} options={Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({ value: value as Equipment, label }))} />
          </Field>
          <Field label="Mesure">
            <Select value={kind} onChange={setKind} options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value: value as ExerciseKind, label }))} />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-silver">Photo (machine, réglages, position…)</div>
          {photo ? (
            <div className="relative overflow-hidden rounded-xl border border-line">
              <img src={photo} alt="Photo de l'exercice" className="max-h-48 w-full object-cover" />
              <button aria-label="Retirer la photo" onClick={() => setPhoto(undefined)} className="press absolute top-2 right-2 rounded-full bg-ink/80 p-1.5 text-ivory">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="press flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gold/40 py-4 text-sm text-gold active:bg-gold/10"
            >
              <Camera size={18} /> Prendre la machine en photo
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) setPhoto(await compressImage(f, 900, 0.78))
            }}
          />
        </div>
        <Field label="Notes (réglages machine, consignes…)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} placeholder="Ex. siège cran 4, dossier incliné à 30°" />
        </Field>
        <Button variant="primary" size="lg" className="w-full" disabled={!trimmed} onClick={save}>
          Enregistrer
        </Button>
      </div>
    </Sheet>
  )
}
