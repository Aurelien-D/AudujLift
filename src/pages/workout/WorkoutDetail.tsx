import { useLiveQuery } from 'dexie-react-hooks'
import { Clock, Dumbbell, Flame, Pencil, Repeat, Save, Trash2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, IconButton, NumberInput, Page, Stat } from '../../components/ui'
import { columnsFor, formatSet, readCol, setLabels, writeCol } from '../../components/workout-parts'
import { db } from '../../lib/db'
import { useDoneWorkouts, useExerciseMap, useSettings } from '../../lib/hooks'
import { detectPRs, weeklyStreak, workoutTotals } from '../../lib/stats'
import type { Workout } from '../../lib/types'
import { cn, formatDate, formatDuration, formatNumber, formatTime, uid } from '../../lib/utils'
import { SET_TYPE_LABELS, workoutToRoutineExercises } from '../../lib/workout'

export default function WorkoutDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const summary = params.get('summary') === '1'
  const navigate = useNavigate()
  const exMap = useExerciseMap()
  const settings = useSettings()
  const all = useDoneWorkouts()
  const workout = useLiveQuery(() => (id ? db.workouts.get(id) : undefined), [id])
  const routine = useLiveQuery(() => (workout?.routineId ? db.routines.get(workout.routineId) : undefined), [workout?.routineId])
  const [edit, setEdit] = useState<Workout | null>(null)
  const [routineSaved, setRoutineSaved] = useState(false)

  const prs = useMemo(() => (workout && all ? detectPRs(workout, all, exMap, workout.bodyweight) : []), [workout, all, exMap])
  const streak = useMemo(
    () =>
      weeklyStreak(
        (all ?? []).map((w) => w.startedAt),
        settings.weeklyWorkoutGoal,
      ),
    [all, settings.weeklyWorkoutGoal],
  )

  if (workout === undefined)
    return (
      <Page back title="Séance">
        {null}
      </Page>
    )
  if (workout === null)
    return (
      <Page back title="Séance introuvable">
        {null}
      </Page>
    )

  const w = edit ?? workout
  const totals = workoutTotals(w, exMap)
  const number = (all ?? []).filter((x) => x.startedAt <= workout.startedAt).length

  const remove = async () => {
    if (!confirm('Supprimer définitivement cette séance ?')) return
    await db.workouts.delete(workout.id)
    navigate('/workouts/history', { replace: true })
  }
  const saveAsRoutine = async () => {
    const now = Date.now()
    if (routine) {
      await db.routines.update(routine.id, { exercises: workoutToRoutineExercises(workout), updatedAt: now })
    } else {
      await db.routines.add({ id: uid(), name: workout.name, exercises: workoutToRoutineExercises(workout), createdAt: now, updatedAt: now })
    }
    setRoutineSaved(true)
  }
  const saveEdit = async () => {
    if (edit) await db.workouts.put(edit)
    setEdit(null)
  }

  return (
    <Page
      back={summary ? '/' : true}
      title={summary ? 'Séance terminée' : w.name}
      actions={
        !summary &&
        (edit ? (
          <Button variant="primary" size="sm" onClick={saveEdit}>
            Enregistrer
          </Button>
        ) : (
          <IconButton aria-label="Modifier" onClick={() => setEdit(structuredClone(workout))}>
            <Pencil size={20} />
          </IconButton>
        ))
      }
    >
      {summary && (
        <div className="animate-pop mb-4 rounded-3xl bg-gradient-accent p-5 text-zinc-950">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-1 text-2xl font-black">Bravo{settings.name ? ` ${settings.name}` : ''} !</h2>
          <p className="text-sm font-medium opacity-80">
            C'est ta {number}
            <sup>{number === 1 ? 're' : 'e'}</sup> séance
            {streak > 0 && ` · série de ${streak} semaine${streak > 1 ? 's' : ''} 🔥`}
          </p>
        </div>
      )}

      {edit ? (
        <input
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          className="mb-2 w-full rounded-lg bg-zinc-900 px-2 py-1 text-xl font-bold outline-none"
        />
      ) : (
        summary && <h2 className="text-xl font-bold">{w.name}</h2>
      )}
      <p className="text-sm text-zinc-400">
        {formatDate(w.startedAt)} · {formatTime(w.startedAt)}
      </p>

      <Card className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Durée" value={formatDuration(totals.durationMs)} />
        <Stat label="Volume" value={formatNumber(totals.volume, 0)} unit="kg" />
        <Stat label="Séries" value={totals.sets} />
      </Card>

      {prs.length > 0 && (
        <Card className="mt-3 border-amber-400/30 bg-amber-400/5">
          <div className="mb-2 flex items-center gap-2 font-bold text-amber-300">
            <Trophy size={18} /> {prs.length} record{prs.length > 1 ? 's' : ''} personnel{prs.length > 1 ? 's' : ''} !
          </div>
          <ul className="space-y-1 text-sm">
            {prs.map((p, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate text-zinc-300">
                  {exMap.get(p.exerciseId)?.name} — {p.label}
                </span>
                <span className="shrink-0 font-semibold text-amber-200">{p.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {summary && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={saveAsRoutine} disabled={routineSaved}>
            {routine ? <Repeat size={18} /> : <Save size={18} />}
            {routineSaved ? 'Enregistré ✓' : routine ? 'Mettre à jour la routine' : 'Créer une routine'}
          </Button>
          <Button variant="primary" onClick={() => navigate('/')}>
            Terminer
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {w.exercises.map((we, ei) => {
          const ex = exMap.get(we.exerciseId)
          const kind = ex?.kind ?? 'weight_reps'
          const labels = setLabels(we.sets.map((s) => s.type))
          return (
            <Card key={we.uid} className="p-3">
              <button onClick={() => navigate(`/exercises/${we.exerciseId}`)} className="flex items-center gap-2 text-left font-semibold text-lime-300">
                <Dumbbell size={16} /> {ex?.name ?? 'Exercice supprimé'}
              </button>
              {we.notes && <p className="mt-1 text-sm text-amber-200/80">{we.notes}</p>}
              <div className="mt-2 space-y-1">
                {we.sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-3 text-sm">
                    <span className={cn('w-6 text-center font-bold', SET_TYPE_LABELS[s.type].color)}>{labels[si]}</span>
                    {edit ? (
                      columnsFor(kind).map((col) => (
                        <NumberInput
                          key={col.key}
                          aria-label={col.label}
                          value={readCol(s, col)}
                          decimals={col.decimals}
                          onChange={(v) => {
                            const next = structuredClone(edit)
                            next.exercises[ei].sets[si] = { ...s, [col.key]: writeCol(v, col) }
                            setEdit(next)
                          }}
                          className="h-8 w-20 py-1 text-center"
                        />
                      ))
                    ) : (
                      <span className="text-zinc-200">{formatSet(s, kind)}</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      {edit && (
        <textarea
          value={edit.notes ?? ''}
          onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
          placeholder="Notes de séance"
          className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none"
        />
      )}
      {!edit && w.notes && <p className="mt-3 text-sm text-zinc-400">{w.notes}</p>}

      {!summary && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={saveAsRoutine} disabled={routineSaved}>
            <Save size={18} /> {routineSaved ? 'Enregistré ✓' : 'Créer une routine'}
          </Button>
          <Button variant="danger" onClick={remove}>
            <Trash2 size={18} /> Supprimer
          </Button>
        </div>
      )}
      {summary && (
        <p className="mt-6 flex items-center justify-center gap-1 text-xs text-zinc-500">
          <Clock size={12} /> Repos bien mérité · <Flame size={12} /> pense à tes protéines
        </p>
      )}
    </Page>
  )
}
