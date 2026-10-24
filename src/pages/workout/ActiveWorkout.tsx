import {
  ArrowDown,
  ArrowUp,
  Calculator,
  Check,
  ChevronDown,
  Flame,
  LineChart,
  Link2,
  MoreVertical,
  Plus,
  RefreshCw,
  StickyNote,
  Trash2,
  TrendingDown,
  TrendingUp,
  Unlink,
  X,
  Gauge,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExercisePicker, ExerciseThumb } from '../../components/ExercisePicker'
import { PlateCalculator } from '../../components/PlateCalculator'
import { SolarSigil } from '../../components/SolarSigil'
import { ActionList, Button, IconButton, NumberInput, Sheet, Toast } from '../../components/ui'
import { columnsFor, formatSet, readCol, RestSelect, RpePicker, setLabels, SetStepper, SetTypeSheet, supersetColor, SwipeRow, writeCol } from '../../components/workout-parts'
import { db } from '../../lib/db'
import { MUSCLE_LABELS } from '../../lib/exercises-data'
import { useDoneWorkouts, useExerciseMap, useNow, useSettings } from '../../lib/hooks'
import { rpeLoadSuggestion } from '../../lib/insights'
import { usesBar, warmupSets } from '../../lib/progression'
import { restTimer, unlockAudio } from '../../lib/restTimer'
import { e1rm, effectiveLoad, exerciseHistory, personalRecords, workoutTotals } from '../../lib/stats'
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '../../lib/types'
import { cn, formatClock, formatNumber, uid } from '../../lib/utils'
import { useWakeLock } from '../../lib/wakeLock'
import { finishWorkout, getActiveWorkout, newWorkoutExercise, SET_TYPE_LABELS } from '../../lib/workout'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Prochaine série à faire après la série `idx` de `we` (en superset : l'exercice suivant du groupe). */
function nextPending(w: Workout, we: WorkoutExercise, idx: number): { we: WorkoutExercise; idx: number } | undefined {
  const pending = (e: WorkoutExercise) => e.sets.findIndex((s, j) => !s.done && !(e.uid === we.uid && j === idx))
  const i = w.exercises.findIndex((e) => e.uid === we.uid)
  const group = we.supersetId ? w.exercises.filter((e) => e.supersetId === we.supersetId) : [we]
  for (const e of group) {
    const j = pending(e)
    if (j >= 0) return { we: e, idx: j }
  }
  for (const e of w.exercises.slice(i + 1)) {
    const j = pending(e)
    if (j >= 0) return { we: e, idx: j }
  }
  return undefined
}

export default function ActiveWorkout() {
  const navigate = useNavigate()
  const exMap = useExerciseMap()
  const history = useDoneWorkouts()
  const settings = useSettings()
  const now = useNow()
  const [w, setW] = useState<Workout | null>(null)
  const loaded = useRef(false)
  const [picker, setPicker] = useState<{ replace?: string } | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [setMenuTarget, setSetMenuTarget] = useState<{ ex: string; idx: number } | null>(null)
  const [plates, setPlates] = useState<number | undefined | null>(null)
  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({})
  const [editName, setEditName] = useState(false)
  const [rpeFor, setRpeFor] = useState<{ ex: string; idx: number } | null>(null)
  const [rpeHint, setRpeHint] = useState<{ ex: string; idx: number; weight: number; planned: number; rpe: number } | null>(null)
  const [record, setRecord] = useState<{ name: string; from: number; to: number } | null>(null)
  const [undo, setUndo] = useState<{ ex: string; idx: number; set: WorkoutSet } | null>(null)

  useWakeLock(settings.keepAwake)

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

  useEffect(() => {
    if (!record) return
    const t = setTimeout(() => setRecord(null), 3500)
    return () => clearTimeout(t)
  }, [record])

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 5000)
    return () => clearTimeout(t)
  }, [undo])

  /** Dernière séance de chaque exercice (colonne « Précédent ») et meilleur 1RM estimé historique */
  const { previous, bests } = useMemo(() => {
    const previous = new Map<string, WorkoutSet[]>()
    const bests = new Map<string, number>()
    if (!w || !history) return { previous, bests }
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId)
      if (!ex || previous.has(ex.id)) continue
      const hist = exerciseHistory(ex, history, w.bodyweight)
      if (hist[0]) previous.set(ex.id, hist[0].sets)
      const best = personalRecords(hist).bestE1rm?.value
      if (best) bests.set(ex.id, best)
    }
    return { previous, bests }
  }, [w, history, exMap])

  if (!w) return null

  const totals = workoutTotals(w, exMap)
  const doneSets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
  const allSets = w.exercises.reduce((n, e) => n + e.sets.length, 0)
  const update = (patch: Partial<Workout>) => setW((cur) => (cur ? { ...cur, ...patch } : cur))
  const updateEx = (exUid: string, fn: (e: WorkoutExercise) => WorkoutExercise) =>
    setW((cur) => (cur ? { ...cur, exercises: cur.exercises.map((e) => (e.uid === exUid ? fn(e) : e)) } : cur))
  const updateSet = (exUid: string, idx: number, patch: Partial<WorkoutSet>) => updateEx(exUid, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }))
  const kindOf = (we: WorkoutExercise) => exMap.get(we.exerciseId)?.kind ?? 'weight_reps'

  const describe = (target: { we: WorkoutExercise; idx: number }, from: WorkoutExercise) => {
    const ex = exMap.get(target.we.exerciseId)
    const s = target.we.sets[target.idx]
    const label = s.type === 'warmup' ? 'Échauffement' : `Série ${setLabels(target.we.sets.map((x) => x.type))[target.idx] || target.idx + 1}`
    const what = formatSet(s, ex?.kind ?? 'weight_reps')
    return target.we.uid === from.uid ? `${label} · ${what}` : `${ex?.name ?? 'Exercice'} · ${what}`
  }

  /** Record en direct : la série bat le meilleur 1RM estimé (historique et séance en cours). */
  const checkRecord = (ex: Exercise | undefined, we: WorkoutExercise, idx: number, s: WorkoutSet) => {
    if (!ex || (ex.kind !== 'weight_reps' && ex.kind !== 'bodyweight') || s.type === 'warmup') return
    const histBest = bests.get(ex.id)
    if (!histBest) return // première fois : pas de « record »
    const bw = w.bodyweight ?? 0
    const value = e1rm(effectiveLoad(s, ex.kind, bw), s.reps ?? 0)
    let sessionBest = 0
    for (const e of w.exercises)
      if (e.exerciseId === ex.id)
        e.sets.forEach((x, j) => {
          if (x.done && x.type !== 'warmup' && !(e.uid === we.uid && j === idx)) sessionBest = Math.max(sessionBest, e1rm(effectiveLoad(x, ex.kind, bw), x.reps ?? 0))
        })
    const best = Math.max(histBest, sessionBest)
    if (value > best + 0.01) {
      navigator.vibrate?.([20, 60, 20, 60, 40])
      setRecord({ name: ex.name, from: best, to: value })
    }
  }

  const toggleDone = (we: WorkoutExercise, idx: number) => {
    unlockAudio()
    const s = we.sets[idx]
    if (s.done) {
      if (rpeFor?.ex === we.uid && rpeFor.idx === idx) setRpeFor(null)
      return updateSet(we.uid, idx, { done: false, completedAt: undefined })
    }
    const prev = previous.get(we.exerciseId)?.[idx]
    const ex = exMap.get(we.exerciseId)
    const kind = kindOf(we)
    const patch: Partial<WorkoutSet> = { done: true, completedAt: Date.now() }
    // Valide avec la valeur précédente si le champ est vide
    for (const col of columnsFor(kind)) if (s[col.key] == null && prev?.[col.key] != null) patch[col.key] = prev[col.key]
    updateSet(we.uid, idx, patch)
    if (rpeHint?.ex === we.uid) setRpeHint(null)
    navigator.vibrate?.(15)
    checkRecord(ex, we, idx, { ...s, ...patch })
    setRpeFor(settings.askRpe && (kind === 'weight_reps' || kind === 'bodyweight') && s.type !== 'warmup' ? { ex: we.uid, idx } : null)

    const next = nextPending(w, we, idx)
    // Repos : en superset, uniquement après le dernier exercice du groupe
    const i = w.exercises.findIndex((e) => e.uid === we.uid)
    const nextInSuperset = we.supersetId && w.exercises[i + 1]?.supersetId === we.supersetId
    if (!nextInSuperset && we.restSec > 0) restTimer.start(we.restSec, next ? describe(next, we) : undefined)
    // Exercice terminé : on fait défiler jusqu'au suivant
    const finished = we.sets.every((x, j) => j === idx || x.done)
    if (finished && next && next.we.uid !== we.uid)
      setTimeout(() => document.getElementById(`ex-${next.we.uid}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }), 250)
  }

  /** Après une note d'effort, propose la charge de la série suivante (RPE 8 visé). */
  const suggestFromRpe = (we: WorkoutExercise, idx: number, rpe: number | undefined) => {
    setRpeHint(null)
    const s = we.sets[idx]
    if (rpe == null || kindOf(we) !== 'weight_reps' || !s.weight || !s.reps) return
    const j = we.sets.findIndex((x, k) => k > idx && !x.done && x.type !== 'warmup')
    if (j < 0) return
    const next = we.sets[j]
    const planned = next.weight ?? s.weight
    const weight = rpeLoadSuggestion({ weight: s.weight, reps: s.reps, rpe }, { weight: planned, reps: next.reps ?? s.reps })
    if (weight != null) setRpeHint({ ex: we.uid, idx: j, weight, planned, rpe })
  }

  /** Applique la charge conseillée à toutes les séries restantes prévues à la même charge. */
  const applyRpeHint = (exUid: string) => {
    if (!rpeHint) return
    const { idx, weight, planned } = rpeHint
    updateEx(exUid, (e) => ({ ...e, sets: e.sets.map((x, k) => (k >= idx && !x.done && x.type !== 'warmup' && (x.weight ?? planned) === planned ? { ...x, weight } : x)) }))
    setRpeHint(null)
  }

  const deleteSet = (exUid: string, idx: number) => {
    const we = w.exercises.find((e) => e.uid === exUid)
    if (!we) return
    setUndo({ ex: exUid, idx, set: we.sets[idx] })
    setRpeFor(null)
    updateEx(exUid, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== idx) }))
  }

  const restoreSet = () => {
    if (!undo) return
    updateEx(undo.ex, (e) => ({ ...e, sets: [...e.sets.slice(0, undo.idx), undo.set, ...e.sets.slice(undo.idx)] }))
    setUndo(null)
  }

  const addWarmup = (we: WorkoutExercise) => {
    const ex = exMap.get(we.exerciseId)
    const work = we.sets.find((s) => s.type !== 'warmup' && s.weight)?.weight ?? previous.get(we.exerciseId)?.find((s) => s.type !== 'warmup')?.weight
    if (!ex || !work) return alert("Renseigne d'abord la charge de ta première série de travail.")
    const warm = warmupSets(work, settings.barWeight, usesBar(ex)).map((s): WorkoutSet => ({ ...s, done: false }))
    if (!warm.length) return alert('Charge trop légère pour un échauffement progressif.')
    updateEx(we.uid, (e) => ({ ...e, sets: [...warm, ...e.sets.filter((s) => s.type !== 'warmup' || s.done)] }))
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
    const pending = allSets - doneSets
    if (doneSets === 0) {
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
  const menuKind = menuEx ? kindOf(menuEx) : 'weight_reps'

  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-ink/92 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-3">
          <IconButton aria-label="Réduire" onClick={() => navigate(-1)}>
            <ChevronDown size={24} />
          </IconButton>
          <div className="min-w-0 flex-1 text-center leading-tight">
            <div className="font-display text-xl font-semibold text-ivory">{formatClock((now - w.startedAt) / 1000)}</div>
            <div className="text-[11px] text-silver">
              {doneSets}/{allSets} séries
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={finish}>
            Terminer
          </Button>
        </div>
        <div className="h-0.5 bg-raised">
          <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${allSets ? (doneSets / allSets) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-3 pt-4 pb-44">
        {editName ? (
          <input
            autoFocus
            value={w.name}
            onChange={(e) => update({ name: e.target.value })}
            onBlur={() => setEditName(false)}
            className="font-display w-full rounded-lg bg-surface px-2 py-1 text-2xl font-semibold outline-none"
          />
        ) : (
          <h1 className="px-1 text-2xl font-semibold" onClick={() => setEditName(true)}>
            {w.name}
          </h1>
        )}
        <div className="mt-2 flex gap-4 px-1 text-sm">
          <span className="text-silver">
            Volume <span className="font-semibold text-ivory">{formatNumber(totals.volume, 0)} kg</span>
          </span>
          <span className="text-silver">
            Reps <span className="font-semibold text-ivory">{totals.reps}</span>
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {w.exercises.map((we) => {
            const ex = exMap.get(we.exerciseId)
            const kind = ex?.kind ?? 'weight_reps'
            const cols = columnsFor(kind)
            const labels = setLabels(we.sets.map((s) => s.type))
            const prev = previous.get(we.exerciseId)
            const color = supersetColor(we.supersetId, allSuperset)
            const doneCount = we.sets.filter((s) => s.done).length
            const allDone = we.sets.length > 0 && doneCount === we.sets.length
            const activeIdx = we.sets.findIndex((s) => !s.done)
            return (
              <section
                key={we.uid}
                id={`ex-${we.uid}`}
                className={cn('scroll-mt-20 rounded-[18px] border bg-surface p-3 transition-colors', allDone ? 'border-gold/25' : 'border-line/70')}
              >
                <div className="border-l-2 pl-2" style={{ borderColor: color ?? 'transparent' }}>
                  {color && (
                    <div className="label" style={{ color }}>
                      Superset
                    </div>
                  )}
                  <div className="flex items-center gap-2.5">
                    {ex && (
                      <button aria-label="Fiche de l'exercice" onClick={() => navigate(`/exercises/${we.exerciseId}`)} className="press">
                        <ExerciseThumb exercise={ex} />
                      </button>
                    )}
                    <button onClick={() => navigate(`/exercises/${we.exerciseId}`)} className="min-w-0 flex-1 text-left">
                      <div className={cn('font-display truncate text-base font-semibold', allDone ? 'text-gold' : 'text-ivory')}>
                        {ex?.name ?? 'Exercice'}
                        {allDone && <Check size={16} className="ml-1 inline" />}
                      </div>
                      <div className="truncate text-xs text-silver">
                        {ex ? MUSCLE_LABELS[ex.muscle] : ''} · {doneCount}/{we.sets.length} séries
                      </div>
                    </button>
                    <IconButton aria-label="Note" onClick={() => setShowNotes((s) => ({ ...s, [we.uid]: !s[we.uid] }))}>
                      <StickyNote size={18} className={we.notes ? 'text-warn' : ''} />
                    </IconButton>
                    <IconButton aria-label="Options" onClick={() => setMenu(we.uid)}>
                      <MoreVertical size={18} />
                    </IconButton>
                  </div>
                  {we.deload != null && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-warn/10 px-2 py-1.5 text-xs text-warn">
                      <TrendingDown size={14} className="shrink-0" />
                      <span>Semaine allégée : charge plafonnée à {formatNumber(we.deload)} kg pour relancer la progression</span>
                    </div>
                  )}
                  {we.progression && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-gold/10 px-2 py-1.5 text-xs text-gold-pale">
                      <TrendingUp size={14} className="shrink-0 text-gold" />
                      <span>
                        +{formatNumber(we.progression.to - we.progression.from)} kg : toutes tes reps réussies à {formatNumber(we.progression.from)} kg la dernière fois
                      </span>
                    </div>
                  )}
                  {(showNotes[we.uid] || we.notes) && (
                    <textarea
                      value={we.notes ?? ''}
                      onChange={(e) => updateEx(we.uid, (x) => ({ ...x, notes: e.target.value || undefined }))}
                      placeholder="Note pour cet exercice…"
                      rows={1}
                      className="mt-2 w-full resize-none rounded-lg bg-ink/60 px-2 py-1.5 text-sm text-gold-pale/90 outline-none placeholder:text-silver-dim"
                    />
                  )}
                  <div className="mt-2">
                    <RestSelect value={we.restSec} onChange={(v) => updateEx(we.uid, (e) => ({ ...e, restSec: v }))} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_3rem] items-center gap-1.5 px-1 text-[10.5px] font-semibold tracking-wider text-silver uppercase">
                  <span className="text-center">Série</span>
                  <span className="text-center">Précédent</span>
                  <span className="text-center">{cols[0].label}</span>
                  <span className="text-center">{cols[1].label}</span>
                  <span className="text-center">OK</span>
                </div>
                {we.sets.map((s, i) => {
                  const p = prev?.[i]
                  const isActive = i === activeIdx
                  return (
                    <div key={i} className="mt-1">
                      <SwipeRow onDelete={() => deleteSet(we.uid, i)}>
                        <div
                          className={cn(
                            'grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_3rem] items-center gap-1.5 rounded-xl px-1 py-1 transition-colors',
                            s.done ? 'bg-gold/8' : isActive ? 'bg-raised/60 ring-1 ring-gold/25' : '',
                          )}
                        >
                          <button
                            aria-label="Type de série"
                            onClick={() => setSetMenuTarget({ ex: we.uid, idx: i })}
                            className={cn('flex h-10 flex-col items-center justify-center rounded-lg bg-raised text-sm leading-none font-semibold', SET_TYPE_LABELS[s.type].color)}
                          >
                            {labels[i]}
                            {s.rpe != null && <span className="mt-0.5 text-[9px] font-medium text-gold">@{s.rpe}</span>}
                          </button>
                          <button
                            className="truncate text-center text-xs text-silver"
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
                              className={cn('h-10 px-1 py-1 text-center font-semibold', s.done && 'border-transparent bg-transparent')}
                            />
                          ))}
                          <button
                            aria-label={s.done ? 'Annuler la validation' : 'Valider la série'}
                            onClick={() => toggleDone(we, i)}
                            className={cn(
                              'press flex h-10 items-center justify-center rounded-lg',
                              s.done ? 'animate-pop bg-gold text-ink' : isActive ? 'border border-gold/50 bg-raised text-gold' : 'bg-raised text-silver active:bg-line',
                            )}
                          >
                            <Check size={20} strokeWidth={2.6} />
                          </button>
                        </div>
                      </SwipeRow>
                      {isActive && rpeHint?.ex === we.uid && rpeHint.idx === i && (
                        <div className="animate-fade mt-1.5 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/8 px-3 py-2 text-xs">
                          <Gauge size={16} className="shrink-0 text-gold" />
                          <span className="min-w-0 flex-1 text-ivory-dim">
                            Effort {rpeHint.rpe}/10 : vise <b className="text-gold">{formatNumber(rpeHint.weight)} kg</b> (prévu {formatNumber(rpeHint.planned)} kg)
                          </span>
                          <button onClick={() => applyRpeHint(we.uid)} className="press rounded-lg bg-gold px-2.5 py-1.5 font-semibold text-ink">
                            Appliquer
                          </button>
                          <button aria-label="Ignorer" onClick={() => setRpeHint(null)} className="press px-1 text-silver">
                            ✕
                          </button>
                        </div>
                      )}
                      {isActive && <SetStepper set={s} cols={cols} onChange={(key, v) => updateSet(we.uid, i, { [key]: v })} />}
                      {rpeFor?.ex === we.uid && rpeFor.idx === i && s.done && (
                        <RpePicker
                          value={s.rpe}
                          onPick={(v) => {
                            updateSet(we.uid, i, { rpe: v })
                            setRpeFor(null)
                            suggestFromRpe(we, i, v)
                          }}
                          onClose={() => setRpeFor(null)}
                        />
                      )}
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

        {w.exercises.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            <SolarSigil size={40} className="text-gold/70" />
            <p className="mt-3 text-sm text-silver">Ajoute ton premier exercice pour commencer.</p>
          </div>
        )}

        <Button variant="outline" size="lg" className="mt-4 w-full" onClick={() => setPicker({})}>
          <Plus size={20} /> Ajouter des exercices
        </Button>
        <Button variant="danger" className="mt-3 w-full" onClick={() => discard()}>
          <X size={18} /> Annuler la séance
        </Button>
        <p className="mt-3 text-center text-xs text-silver-dim">Astuce : glisse une série vers la gauche pour la supprimer.</p>
      </main>

      {record && (
        <Toast tone="record">
          <SolarSigil size={26} className="animate-sun text-gold" />
          <div>
            <div className="label text-amethyst-light">Nouveau record</div>
            <div className="text-ivory">{record.name}</div>
            <div className="text-xs text-silver">
              1RM estimé {formatNumber(record.from)} → <span className="font-semibold text-gold">{formatNumber(record.to)} kg</span>
            </div>
          </div>
        </Toast>
      )}
      {undo && !record && (
        <Toast>
          Série supprimée
          <button onClick={restoreSet} className="press ml-2 rounded-lg px-2 py-1 font-semibold text-gold active:bg-raised">
            Annuler
          </button>
        </Toast>
      )}

      <ExercisePicker
        open={!!picker}
        multiple={!picker?.replace}
        title={picker?.replace ? "Remplacer l'exercice" : undefined}
        onClose={() => setPicker(null)}
        onPick={async (list) => {
          if (picker?.replace) {
            const target = picker.replace
            const fresh = await newWorkoutExercise(list[0])
            updateEx(target, (e) => ({ ...e, exerciseId: list[0].id, progression: undefined, sets: fresh.sets.slice(0, Math.max(1, e.sets.length)) }))
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
                icon: <Flame size={20} />,
                label: "Ajouter les séries d'échauffement",
                onClick: () => (addWarmup(menuEx), setMenu(null)),
                hidden: menuKind !== 'weight_reps',
              },
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
          if (setMenuTarget) deleteSet(setMenuTarget.ex, setMenuTarget.idx)
          setSetMenuTarget(null)
        }}
      />

      {plates !== null && <PlateCalculator open initial={plates} onClose={() => setPlates(null)} />}
    </div>
  )
}
