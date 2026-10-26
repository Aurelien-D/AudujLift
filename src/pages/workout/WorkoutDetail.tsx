import { useLiveQuery } from 'dexie-react-hooks'
import { Clock, Flame, Loader2, Pencil, Repeat, Save, Share2, Trash2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ExerciseThumb } from '../../components/ExercisePicker'
import { RankReveal } from '../../components/RankReveal'
import { SolarSigil } from '../../components/SolarSigil'
import { Button, Card, IconButton, NumberInput, Page, Stat } from '../../components/ui'
import { columnsFor, formatSet, readCol, setLabels, writeCol } from '../../components/workout-parts'
import { db } from '../../lib/db'
import { useDoneWorkouts, useExerciseMap, useSettings } from '../../lib/hooks'
import { renderRecap, shareRecap } from '../../lib/recap'
import { detectPRs, e1rm, weeklyStreak, workoutTotals } from '../../lib/stats'
import type { Exercise, Workout, WorkoutSet } from '../../lib/types'
import { cn, formatDate, formatDuration, formatNumber, formatTime, uid } from '../../lib/utils'
import { SET_TYPE_LABELS, workoutToRoutineExercises } from '../../lib/workout'

/** Meilleure série d'un exercice (1RM estimé le plus haut, sinon la plus longue / la plus lointaine). */
function bestSet(sets: WorkoutSet[], kind: Exercise['kind']): WorkoutSet | undefined {
  const work = sets.filter((s) => s.type !== 'warmup')
  const list = work.length ? work : sets
  const score = (s: WorkoutSet) =>
    kind === 'cardio' ? (s.distance ?? 0) * 1000 + (s.duration ?? 0) : kind === 'duration' ? (s.duration ?? 0) : e1rm(s.weight || 1, s.reps ?? 0) + (s.reps ?? 0) / 1000
  return list.reduce<WorkoutSet | undefined>((best, s) => (!best || score(s) > score(best) ? s : best), undefined)
}

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
  const [sharing, setSharing] = useState(false)
  // Fenêtre des rangs : une seule fois par séance terminée (pas à chaque retour sur le récap)
  const revealKey = `audujlift.rankReveal.${id}`
  const [reveal, setReveal] = useState(() => {
    try {
      return summary && !sessionStorage.getItem(revealKey)
    } catch {
      return summary
    }
  })
  const closeReveal = () => {
    try {
      sessionStorage.setItem(revealKey, '1')
    } catch {
      // stockage indisponible (navigation privée) : la fenêtre se fermera simplement
    }
    setReveal(false)
  }

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
  const share = async () => {
    setSharing(true)
    try {
      const blob = await renderRecap({
        name: workout.name,
        startedAt: workout.startedAt,
        totals: workoutTotals(workout, exMap),
        exercises: workout.exercises.map((we) => {
          const kind = exMap.get(we.exerciseId)?.kind ?? 'weight_reps'
          const b = bestSet(we.sets, kind)
          return { name: exMap.get(we.exerciseId)?.name ?? 'Exercice', best: b ? formatSet(b, kind) : '' }
        }),
        records: prs.map((p) => ({ ...p, exercise: exMap.get(p.exerciseId)?.name ?? '' })),
      })
      await shareRecap(blob, `audujlift-${new Date(workout.startedAt).toISOString().slice(0, 10)}.png`, workout.name)
    } catch (e) {
      alert(`Partage impossible : ${(e as Error).message}`)
    } finally {
      setSharing(false)
    }
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
      {reveal && <RankReveal workout={workout} onClose={closeReveal} />}
      {summary && (
        <Card glow className="animate-rise relative mb-4 overflow-hidden p-5">
          <SolarSigil size={150} className="animate-sun pointer-events-none absolute -top-10 -right-10 text-gold/[0.08]" />
          <SolarSigil size={36} className="animate-sun text-gold" />
          <h2 className="mt-3 text-2xl font-semibold">Bravo{settings.name ? ` ${settings.name}` : ''}.</h2>
          <p className="mt-1 text-sm text-silver">
            C'est ta {number}
            <sup>{number === 1 ? 're' : 'e'}</sup> séance
            {streak > 0 && (
              <>
                {' '}
                ·{' '}
                <span className="text-gold">
                  {streak} semaine{streak > 1 ? 's' : ''}
                </span>{' '}
                d'affilée à l'objectif
              </>
            )}
          </p>
        </Card>
      )}

      {edit ? (
        <input
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          className="font-display mb-2 w-full rounded-lg bg-surface px-2 py-1 text-xl font-semibold outline-none"
        />
      ) : (
        summary && <h2 className="text-xl font-semibold">{w.name}</h2>
      )}
      <p className="text-sm text-silver">
        {formatDate(w.startedAt)} · {formatTime(w.startedAt)}
      </p>

      <Card className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Durée" value={formatDuration(totals.durationMs)} />
        <Stat label="Volume" value={formatNumber(totals.volume, 0)} unit="kg" />
        <Stat label="Séries" value={totals.sets} />
      </Card>

      {prs.length > 0 && (
        <div className={cn('mt-3 rounded-[18px] border border-amethyst/50 bg-surface p-4', summary && 'animate-record')}>
          <div className="mb-3 flex items-center gap-2">
            <Trophy size={18} className="text-amethyst-light" />
            <span className="font-display font-semibold text-ivory">
              {prs.length} record{prs.length > 1 ? 's' : ''} personnel{prs.length > 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-2.5 text-sm">
            {prs.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-ivory">{exMap.get(p.exerciseId)?.name}</span>
                  <span className="text-xs text-silver">{p.label}</span>
                </span>
                <span className="shrink-0 text-right">
                  {p.previous && <span className="mr-1.5 text-xs text-silver line-through decoration-silver-dim">{p.previous}</span>}
                  <span className="font-display font-semibold text-gold">{p.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={saveAsRoutine} disabled={routineSaved}>
              {routine ? <Repeat size={18} /> : <Save size={18} />}
              {routineSaved ? 'Enregistré ✓' : routine ? 'Mettre à jour la routine' : 'Créer une routine'}
            </Button>
            <Button variant="primary" onClick={() => navigate('/')}>
              Terminer
            </Button>
          </div>
          <Button variant="tertiary" className="mt-1 w-full" onClick={share} disabled={sharing}>
            {sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Partager le récap
          </Button>
        </>
      )}

      <div className="mt-4 space-y-3">
        {w.exercises.map((we, ei) => {
          const ex = exMap.get(we.exerciseId)
          const kind = ex?.kind ?? 'weight_reps'
          const labels = setLabels(we.sets.map((s) => s.type))
          return (
            <Card key={we.uid} className="p-3">
              <button onClick={() => navigate(`/exercises/${we.exerciseId}`)} className="flex items-center gap-3 text-left">
                {ex && <ExerciseThumb exercise={ex} />}
                <span className="font-display font-semibold text-ivory">{ex?.name ?? 'Exercice supprimé'}</span>
              </button>
              {we.notes && <p className="mt-1 text-sm text-gold-pale/80">{we.notes}</p>}
              <div className="mt-2 space-y-1">
                {we.sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-3 text-sm">
                    <span className={cn('w-6 text-center font-semibold', SET_TYPE_LABELS[s.type].color)}>{labels[si]}</span>
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
                      <span className="text-ivory">
                        {formatSet(s, kind)}
                        {s.rpe != null && <span className="ml-2 text-xs text-gold">@{s.rpe}</span>}
                      </span>
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
          className="mt-3 w-full rounded-xl border border-line bg-ink p-3 text-sm outline-none"
        />
      )}
      {!edit && w.notes && <p className="mt-3 text-sm text-silver">{w.notes}</p>}

      {!summary && !edit && (
        <Button variant="tertiary" className="mt-4 w-full" onClick={share} disabled={sharing}>
          {sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Partager le récap
        </Button>
      )}
      {!summary && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={saveAsRoutine} disabled={routineSaved}>
            <Save size={18} /> {routineSaved ? 'Enregistré ✓' : 'Créer une routine'}
          </Button>
          <Button variant="danger" onClick={remove}>
            <Trash2 size={18} /> Supprimer
          </Button>
        </div>
      )}
      {summary && (
        <p className="mt-6 flex items-center justify-center gap-1 text-xs text-silver">
          <Clock size={12} /> Repos bien mérité · <Flame size={12} /> pense à tes protéines
        </p>
      )}
    </Page>
  )
}
