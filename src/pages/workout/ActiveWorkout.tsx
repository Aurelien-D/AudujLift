import { ArrowDown, ArrowUp, Calculator, Check, ChevronDown, LineChart, Link2, MoreVertical, Plus, RefreshCw, StickyNote, Trash2, Unlink, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExercisePicker } from '../../components/ExercisePicker'
import { PlateCalculator } from '../../components/PlateCalculator'
import { ActionList, Button, IconButton, NumberInput, Sheet } from '../../components/ui'
import { columnsFor, formatSet, readCol, RestSelect, setLabels, SetTypeSheet, supersetColor, writeCol } from '../../components/workout-parts'
import { db } from '../../lib/db'
import { useDoneWorkouts, useExerciseMap, useNow } from '../../lib/hooks'
import { restTimer, unlockAudio } from '../../lib/restTimer'
import { exerciseHistory, workoutTotals } from '../../lib/stats'
import type { Workout, WorkoutExercise, WorkoutSet } from '../../lib/types'
import { cn, formatClock, formatNumber, uid } from '../../lib/utils'
import { finishWorkout, getActiveWorkout, newWorkoutExercise, SET_TYPE_LABELS } from '../../lib/workout'

export default function ActiveWorkout() {
  const navigate = useNavigate()
  const exMap = useExerciseMap()
  const history = useDoneWorkouts()
  const now = useNow()
  const [w, setW] = useState<Workout | null>(null)
  const loaded = useRef(false)
  const [picker, setPicker] = useState<{ replace?: string } | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [setMenuTarget, setSetMenuTarget] = useState<{ ex: string; idx: number } | null>(null)
  const [plates, setPlates] = useState<number | undefined | null>(null)
  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({})
  const [editName, setEditName] = useState(false)

  useEffect(() => {
    getActiveWorkout().then((a) => {
      if (!a) navigate('/workouts', { replace: true })
      else {
        setW(a)
        loaded.current = true
      }
    })
  }, [navigate])

  // Sauvegarde continue : rien n'est perdu si l'app est fermée en pleine séance
  useEffect(() => {
    if (w && loaded.current) void db.workouts.put(w)
  }, [w])

  /** Dernière séance de chaque exercice (colonne « Précédent ») */
  const previous = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>()
    if (!w || !history) return map
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId)
      if (!ex || map.has(ex.id)) continue
      const last = exerciseHistory(ex, history.slice(0, 80))[0]
      if (last) map.set(ex.id, last.sets)
    }
    return map
  }, [w, history, exMap])

  if (!w) return null

  const totals = workoutTotals(w, exMap)
  const update = (patch: Partial<Workout>) => setW((cur) => (cur ? { ...cur, ...patch } : cur))
  const updateEx = (exUid: string, fn: (e: WorkoutExercise) => WorkoutExercise) =>
    setW((cur) => (cur ? { ...cur, exercises: cur.exercises.map((e) => (e.uid === exUid ? fn(e) : e)) } : cur))
  const updateSet = (exUid: string, idx: number, patch: Partial<WorkoutSet>) => updateEx(exUid, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }))

  const toggleDone = (we: WorkoutExercise, idx: number) => {
    unlockAudio()
    const s = we.sets[idx]
    if (s.done) return updateSet(we.uid, idx, { done: false, completedAt: undefined })
    const prev = previous.get(we.exerciseId)?.[idx]
    const kind = exMap.get(we.exerciseId)?.kind ?? 'weight_reps'
    const patch: Partial<WorkoutSet> = { done: true, completedAt: Date.now() }
    // Valide avec la valeur précédente si le champ est vide
    for (const col of columnsFor(kind)) if (s[col.key] == null && prev?.[col.key] != null) patch[col.key] = prev[col.key]
    updateSet(we.uid, idx, patch)
    navigator.vibrate?.(15)
    // Repos : en superset, uniquement après le dernier exercice du groupe
    const i = w.exercises.findIndex((e) => e.uid === we.uid)
    const nextInSuperset = we.supersetId && w.exercises[i + 1]?.supersetId === we.supersetId
    if (!nextInSuperset && we.restSec > 0) restTimer.start(we.restSec)
  }

  const move = (exUid: string, dir: -1 | 1) => {
    const list = [...w.exercises]
    const i = list.findIndex((e) => e.uid === exUid)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    update({ exercises: list })
  }

  const toggleSuperset = (exUid: string) => {
    const list = [...w.exercises]
    const i = list.findIndex((e) => e.uid === exUid)
    const cur = list[i]
    const next = list[i + 1]
    if (!next) return
    if (cur.supersetId && next.supersetId === cur.supersetId) {
      list[i + 1] = { ...next, supersetId: list[i + 2]?.supersetId === cur.supersetId ? cur.supersetId : undefined }
      if (list[i - 1]?.supersetId !== cur.supersetId) list[i] = { ...cur, supersetId: undefined }
    } else {
      const sid = cur.supersetId ?? next.supersetId ?? uid()
      list[i] = { ...cur, supersetId: sid }
      list[i + 1] = { ...next, supersetId: sid }
    }
    update({ exercises: list })
  }

  const finish = async () => {
    const pending = w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0)
    const doneCount = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
    if (doneCount === 0) {
      if (confirm('Aucune série validée. Annuler la séance ?')) return discard(true)
      return
    }
    const pendingMsg = pending > 1 ? `${pending} séries non validées seront ignorées.` : '1 série non validée sera ignorée.'
    if (pending > 0 && !confirm(`${pendingMsg} Terminer la séance ?`)) return
    loaded.current = false
    restTimer.stop()
    const done = await finishWorkout(w)
    navigate(`/workouts/history/${done.id}?summary=1`, { replace: true })
  }

  const discard = async (skipConfirm = false) => {
    if (!skipConfirm && !confirm('Annuler la séance ? Toutes les séries seront perdues.')) return
    loaded.current = false
    restTimer.stop()
    await db.workouts.delete(w.id)
    navigate('/workouts', { replace: true })
  }

  const allSuperset = w.exercises.map((e) => e.supersetId)
  const menuEx = w.exercises.find((e) => e.uid === menu)
  const menuIdx = w.exercises.findIndex((e) => e.uid === menu)
  const linkedNext = menuEx?.supersetId && w.exercises[menuIdx + 1]?.supersetId === menuEx.supersetId

  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-3">
          <IconButton aria-label="Réduire" onClick={() => navigate(-1)}>
            <ChevronDown size={24} />
          </IconButton>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-xl font-bold tabular-nums">{formatClock((now - w.startedAt) / 1000)}</div>
          </div>
          <Button variant="primary" size="sm" onClick={finish}>
            Terminer
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-3 pt-3 pb-40">
        {editName ? (
          <input
            autoFocus
            value={w.name}
            onChange={(e) => update({ name: e.target.value })}
            onBlur={() => setEditName(false)}
            className="w-full rounded-lg bg-zinc-900 px-2 py-1 text-2xl font-bold outline-none"
          />
        ) : (
          <h1 className="px-1 text-2xl font-bold" onClick={() => setEditName(true)}>
            {w.name}
          </h1>
        )}
        <div className="mt-2 grid grid-cols-3 gap-2 px-1 text-sm">
          <div>
            <div className="text-xs text-zinc-400">Volume</div>
            <div className="font-semibold">{formatNumber(totals.volume, 0)} kg</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400">Séries</div>
            <div className="font-semibold">{totals.sets}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400">Répétitions</div>
            <div className="font-semibold">{totals.reps}</div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {w.exercises.map((we) => {
            const ex = exMap.get(we.exerciseId)
            const kind = ex?.kind ?? 'weight_reps'
            const cols = columnsFor(kind)
            const labels = setLabels(we.sets.map((s) => s.type))
            const prev = previous.get(we.exerciseId)
            const color = supersetColor(we.supersetId, allSuperset)
            const allDone = we.sets.length > 0 && we.sets.every((s) => s.done)
            return (
              <section key={we.uid} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/60 p-3">
                <div className="border-l-2 pl-2" style={{ borderColor: color ?? 'transparent' }}>
                  {color && (
                    <div className="text-[10px] font-bold tracking-wider uppercase" style={{ color }}>
                      Superset
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/exercises/${we.exerciseId}`)}
                      className={cn('min-w-0 flex-1 truncate text-left text-base font-bold', allDone ? 'text-lime-400' : 'text-lime-300')}
                    >
                      {ex?.name ?? 'Exercice'}
                      {allDone && <Check size={16} className="ml-1 inline" />}
                    </button>
                    <IconButton aria-label="Note" onClick={() => setShowNotes((s) => ({ ...s, [we.uid]: !s[we.uid] }))}>
                      <StickyNote size={18} className={we.notes ? 'text-amber-400' : ''} />
                    </IconButton>
                    <IconButton aria-label="Options" onClick={() => setMenu(we.uid)}>
                      <MoreVertical size={18} />
                    </IconButton>
                  </div>
                  {(showNotes[we.uid] || we.notes) && (
                    <textarea
                      value={we.notes ?? ''}
                      onChange={(e) => updateEx(we.uid, (x) => ({ ...x, notes: e.target.value || undefined }))}
                      placeholder="Note pour cet exercice…"
                      rows={1}
                      className="mt-1 w-full resize-none rounded-lg bg-zinc-950/60 px-2 py-1.5 text-sm text-amber-200/90 outline-none placeholder:text-zinc-500"
                    />
                  )}
                  <div className="mt-1">
                    <RestSelect value={we.restSec} onChange={(v) => updateEx(we.uid, (e) => ({ ...e, restSec: v }))} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[2.25rem_1fr_4.5rem_4.5rem_2.75rem] items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                  <span className="text-center">Série</span>
                  <span className="text-center">Précédent</span>
                  <span className="text-center">{cols[0].label}</span>
                  <span className="text-center">{cols[1].label}</span>
                  <span className="text-center">✓</span>
                </div>
                {we.sets.map((s, i) => {
                  const p = prev?.[i]
                  return (
                    <div
                      key={i}
                      className={cn(
                        '-mx-1.5 mt-1 grid grid-cols-[2.25rem_1fr_4.5rem_4.5rem_2.75rem] items-center gap-1.5 rounded-xl px-1.5 py-1 transition-colors',
                        s.done && 'bg-lime-400/10',
                      )}
                    >
                      <button
                        onClick={() => setSetMenuTarget({ ex: we.uid, idx: i })}
                        className={cn('h-9 rounded-lg bg-zinc-800 text-sm font-bold', SET_TYPE_LABELS[s.type].color)}
                      >
                        {labels[i]}
                      </button>
                      <button
                        className="truncate text-center text-xs text-zinc-400"
                        disabled={!p}
                        onClick={() => p && updateSet(we.uid, i, { weight: p.weight, reps: p.reps, duration: p.duration, distance: p.distance })}
                      >
                        {p ? formatSet(p, kind) : '—'}
                      </button>
                      {cols.map((col) => (
                        <NumberInput
                          key={col.key}
                          aria-label={col.label}
                          decimals={col.decimals}
                          value={readCol(s, col)}
                          placeholder={p ? String(readCol(p, col) ?? '') : ''}
                          onChange={(v) => updateSet(we.uid, i, { [col.key]: writeCol(v, col) })}
                          className={cn('h-9 px-1 py-1 text-center font-semibold', s.done && 'border-transparent bg-transparent')}
                        />
                      ))}
                      <button
                        aria-label="Valider la série"
                        onClick={() => toggleDone(we, i)}
                        className={cn(
                          'flex h-9 items-center justify-center rounded-lg transition',
                          s.done ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400 active:bg-zinc-700',
                        )}
                      >
                        <Check size={20} strokeWidth={3} />
                      </button>
                    </div>
                  )
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() =>
                    updateEx(we.uid, (e) => {
                      const last = e.sets.at(-1)
                      return {
                        ...e,
                        sets: [
                          ...e.sets,
                          {
                            type: last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal'),
                            weight: last?.weight,
                            reps: last?.reps,
                            duration: last?.duration,
                            distance: last?.distance,
                            done: false,
                          },
                        ],
                      }
                    })
                  }
                >
                  <Plus size={16} /> Ajouter une série
                </Button>
              </section>
            )
          })}
        </div>

        <Button variant="outline" size="lg" className="mt-4 w-full" onClick={() => setPicker({})}>
          <Plus size={20} /> Ajouter des exercices
        </Button>
        <Button variant="danger" className="mt-3 w-full" onClick={() => discard()}>
          <X size={18} /> Annuler la séance
        </Button>
      </main>

      <ExercisePicker
        open={!!picker}
        multiple={!picker?.replace}
        title={picker?.replace ? "Remplacer l'exercice" : undefined}
        onClose={() => setPicker(null)}
        onPick={async (list) => {
          if (picker?.replace) {
            const target = picker.replace
            const fresh = await newWorkoutExercise(list[0])
            updateEx(target, (e) => ({ ...e, exerciseId: list[0].id, sets: fresh.sets.slice(0, Math.max(1, e.sets.length)) }))
          } else {
            const added = await Promise.all(list.map(newWorkoutExercise))
            setW((cur) => (cur ? { ...cur, exercises: [...cur.exercises, ...added] } : cur))
          }
        }}
      />

      <Sheet open={!!menuEx} onClose={() => setMenu(null)} title={menuEx ? exMap.get(menuEx.exerciseId)?.name : ''}>
        {menuEx && (
          <ActionList
            items={[
              {
                icon: <Calculator size={20} />,
                label: 'Calculateur de disques',
                onClick: () => (setPlates(menuEx.sets.find((s) => !s.done)?.weight ?? menuEx.sets.at(-1)?.weight), setMenu(null)),
              },
              { icon: <LineChart size={20} />, label: 'Historique et records', onClick: () => navigate(`/exercises/${menuEx.exerciseId}`) },
              { icon: <ArrowUp size={20} />, label: 'Monter', onClick: () => (move(menuEx.uid, -1), setMenu(null)), hidden: menuIdx === 0 },
              { icon: <ArrowDown size={20} />, label: 'Descendre', onClick: () => (move(menuEx.uid, 1), setMenu(null)), hidden: menuIdx === w.exercises.length - 1 },
              {
                icon: linkedNext ? <Unlink size={20} /> : <Link2 size={20} />,
                label: linkedNext ? 'Retirer le superset avec le suivant' : 'Superset avec le suivant',
                onClick: () => (toggleSuperset(menuEx.uid), setMenu(null)),
                hidden: menuIdx === w.exercises.length - 1,
              },
              { icon: <RefreshCw size={20} />, label: "Remplacer l'exercice", onClick: () => (setPicker({ replace: menuEx.uid }), setMenu(null)) },
              {
                icon: <Trash2 size={20} />,
                label: "Retirer l'exercice",
                danger: true,
                onClick: () => (update({ exercises: w.exercises.filter((e) => e.uid !== menuEx.uid) }), setMenu(null)),
              },
            ]}
          />
        )}
      </Sheet>

      <SetTypeSheet
        open={!!setMenuTarget}
        onClose={() => setSetMenuTarget(null)}
        onPick={(t) => {
          if (setMenuTarget) updateSet(setMenuTarget.ex, setMenuTarget.idx, { type: t })
          setSetMenuTarget(null)
        }}
        onDelete={() => {
          if (setMenuTarget) updateEx(setMenuTarget.ex, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== setMenuTarget.idx) }))
          setSetMenuTarget(null)
        }}
      />

      {plates !== null && <PlateCalculator open initial={plates} onClose={() => setPlates(null)} />}
    </div>
  )
}
