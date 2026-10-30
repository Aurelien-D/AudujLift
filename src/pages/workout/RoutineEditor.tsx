import { ArrowDown, ArrowUp, ArrowUpDown, Link2, MoreVertical, Plus, RefreshCw, Trash2, Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ExercisePicker } from '../../components/ExercisePicker'
import { ReorderExercises } from '../../components/ReorderExercises'
import { ActionList, Button, Card, EmptyState, IconButton, inputClass, NumberInput, Page, Sheet } from '../../components/ui'
import { columnsFor, readCol, RestSelect, setLabels, SetTypeSheet, supersetColor, writeCol } from '../../components/workout-parts'
import { db } from '../../lib/db'
import { useExerciseMap, useSettings } from '../../lib/hooks'
import type { Routine, RoutineExercise } from '../../lib/types'
import { cn, uid } from '../../lib/utils'
import { newRoutineExercise, SET_TYPE_LABELS } from '../../lib/workout'

export default function RoutineEditor() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const exMap = useExerciseMap()
  const settings = useSettings()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [picker, setPicker] = useState<{ replace?: string } | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [setMenuTarget, setSetMenuTarget] = useState<{ ex: string; idx: number } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [reordering, setReordering] = useState(false)

  useEffect(() => {
    if (isNew) {
      const now = Date.now()
      setRoutine({ id: uid(), name: '', exercises: [], createdAt: now, updatedAt: now })
    } else if (id) {
      db.routines.get(id).then((r) => setRoutine(r ?? null))
    }
  }, [id, isNew])

  if (!routine)
    return (
      <Page title="Routine" back="/workouts">
        {null}
      </Page>
    )

  const update = (patch: Partial<Routine>) => {
    setRoutine({ ...routine, ...patch })
    setDirty(true)
  }
  const updateEx = (uidEx: string, fn: (e: RoutineExercise) => RoutineExercise) => update({ exercises: routine.exercises.map((e) => (e.uid === uidEx ? fn(e) : e)) })

  const move = (uidEx: string, dir: -1 | 1) => {
    const list = [...routine.exercises]
    const i = list.findIndex((e) => e.uid === uidEx)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    update({ exercises: list })
  }

  const toggleSuperset = (uidEx: string) => {
    const list = [...routine.exercises]
    const i = list.findIndex((e) => e.uid === uidEx)
    const cur = list[i]
    const next = list[i + 1]
    if (cur.supersetId && next?.supersetId === cur.supersetId) {
      // Délier
      list[i + 1] = { ...next, supersetId: list[i + 2]?.supersetId === cur.supersetId ? cur.supersetId : undefined }
      const prevLinked = list[i - 1]?.supersetId === cur.supersetId
      if (!prevLinked) list[i] = { ...cur, supersetId: undefined }
    } else if (next) {
      const sid = cur.supersetId ?? next.supersetId ?? uid()
      list[i] = { ...cur, supersetId: sid }
      list[i + 1] = { ...next, supersetId: sid }
    }
    update({ exercises: list })
  }

  const save = async () => {
    const name = routine.name.trim() || 'Ma routine'
    await db.routines.put({ ...routine, name, updatedAt: Date.now() })
    navigate('/workouts')
  }

  const remove = async () => {
    if (!confirm('Supprimer cette routine ?')) return
    await db.routines.delete(routine.id)
    navigate('/workouts')
  }

  const allSuperset = routine.exercises.map((e) => e.supersetId)
  const menuEx = routine.exercises.find((e) => e.uid === menu)
  const menuIdx = routine.exercises.findIndex((e) => e.uid === menu)

  return (
    <Page
      title={isNew ? 'Nouvelle routine' : 'Modifier la routine'}
      back="/workouts"
      actions={
        <Button variant="primary" size="sm" onClick={save} disabled={!dirty && !isNew}>
          Enregistrer
        </Button>
      }
    >
      <input
        value={routine.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="Nom de la routine (ex. Push A)"
        className={cn(inputClass, 'text-lg font-semibold')}
        autoFocus={isNew}
      />
      <input
        value={routine.folder ?? ''}
        onChange={(e) => update({ folder: e.target.value || undefined })}
        placeholder="Dossier / programme (optionnel)"
        className={cn(inputClass, 'mt-2 text-sm')}
      />

      {routine.exercises.length > 1 && (
        <div className="mt-4 -mb-1 flex items-center justify-between px-1">
          <span className="text-xs text-silver">{routine.exercises.length} exercices</span>
          <Button variant="ghost" size="sm" onClick={() => setReordering(true)}>
            <ArrowUpDown size={16} /> Réorganiser
          </Button>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {routine.exercises.length === 0 && <EmptyState title="Aucun exercice">Ajoute les exercices de ta séance, puis définis séries, répétitions et temps de repos.</EmptyState>}
        {routine.exercises.map((re) => {
          const ex = exMap.get(re.exerciseId)
          const cols = columnsFor(ex?.kind ?? 'weight_reps')
          const labels = setLabels(re.sets.map((s) => s.type))
          const color = supersetColor(re.supersetId, allSuperset)
          return (
            <Card key={re.uid} className="p-3">
              <div className="border-l-2 pl-2" style={{ borderColor: color ?? 'transparent' }}>
                {color && (
                  <div className="text-[10px] font-bold tracking-wider uppercase" style={{ color }}>
                    Superset
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <h3 className="line-clamp-2 min-w-0 flex-1 leading-snug font-semibold text-gold-pale">{ex?.name ?? 'Exercice supprimé'}</h3>
                  <IconButton aria-label="Options" onClick={() => setMenu(re.uid)}>
                    <MoreVertical size={18} />
                  </IconButton>
                </div>
                <div className="flex items-center gap-2">
                  <RestSelect value={re.restSec} onChange={(v) => updateEx(re.uid, (e) => ({ ...e, restSec: v }))} />
                </div>
                <input
                  value={re.notes ?? ''}
                  onChange={(e) => updateEx(re.uid, (x) => ({ ...x, notes: e.target.value || undefined }))}
                  placeholder="Note (tempo, réglage…)"
                  className="mt-2 w-full bg-transparent text-sm text-silver outline-none placeholder:text-silver-dim"
                />
              </div>
              <div className="mt-2 grid grid-cols-[2.5rem_1fr_1fr] gap-2 px-1 text-[11px] font-semibold tracking-wide text-silver uppercase">
                <span className="text-center">Série</span>
                <span className="text-center">{cols[0].label} (cible)</span>
                <span className="text-center">{cols[1].label}</span>
              </div>
              {re.sets.map((s, i) => (
                <div key={i} className="mt-1.5 grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2">
                  <button onClick={() => setSetMenuTarget({ ex: re.uid, idx: i })} className={cn('h-9 rounded-lg bg-raised text-sm font-bold', SET_TYPE_LABELS[s.type].color)}>
                    {labels[i]}
                  </button>
                  {cols.map((col) => (
                    <NumberInput
                      key={col.key}
                      aria-label={col.label}
                      decimals={col.decimals}
                      value={readCol(s, col)}
                      placeholder="—"
                      onChange={(v) => updateEx(re.uid, (e) => ({ ...e, sets: e.sets.map((x, j) => (j === i ? { ...x, [col.key]: writeCol(v, col) } : x)) }))}
                      className="h-9 py-1 text-center"
                    />
                  ))}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                onClick={() => updateEx(re.uid, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? { type: 'normal' }) }] }))}
              >
                <Plus size={16} /> Ajouter une série
              </Button>
            </Card>
          )
        })}
      </div>

      <Button variant="outline" size="lg" className="mt-4 w-full" onClick={() => setPicker({})}>
        <Plus size={20} /> Ajouter des exercices
      </Button>
      {!isNew && (
        <Button variant="danger" className="mt-3 w-full" onClick={remove}>
          <Trash2 size={18} /> Supprimer la routine
        </Button>
      )}

      <ExercisePicker
        open={!!picker}
        multiple={!picker?.replace}
        title={picker?.replace ? "Remplacer l'exercice" : undefined}
        onClose={() => setPicker(null)}
        onPick={(list) => {
          if (picker?.replace) {
            updateEx(picker.replace, (e) => ({ ...e, exerciseId: list[0].id }))
          } else {
            update({ exercises: [...routine.exercises, ...list.map((e) => newRoutineExercise(e, settings.defaultRestSec))] })
          }
        }}
      />

      <Sheet open={!!menuEx} onClose={() => setMenu(null)} title={menuEx ? exMap.get(menuEx.exerciseId)?.name : ''}>
        {menuEx && (
          <ActionList
            items={[
              { icon: <ArrowUpDown size={20} />, label: 'Réorganiser les exercices', onClick: () => (setReordering(true), setMenu(null)), hidden: routine.exercises.length < 2 },
              { icon: <ArrowUp size={20} />, label: 'Monter', onClick: () => (move(menuEx.uid, -1), setMenu(null)), hidden: menuIdx === 0 },
              { icon: <ArrowDown size={20} />, label: 'Descendre', onClick: () => (move(menuEx.uid, 1), setMenu(null)), hidden: menuIdx === routine.exercises.length - 1 },
              {
                icon: routine.exercises[menuIdx + 1]?.supersetId && routine.exercises[menuIdx + 1]?.supersetId === menuEx.supersetId ? <Unlink size={20} /> : <Link2 size={20} />,
                label:
                  routine.exercises[menuIdx + 1]?.supersetId && routine.exercises[menuIdx + 1]?.supersetId === menuEx.supersetId
                    ? 'Retirer le superset avec le suivant'
                    : 'Superset avec le suivant',
                onClick: () => (toggleSuperset(menuEx.uid), setMenu(null)),
                hidden: menuIdx === routine.exercises.length - 1,
              },
              { icon: <RefreshCw size={20} />, label: "Remplacer l'exercice", onClick: () => (setPicker({ replace: menuEx.uid }), setMenu(null)) },
              {
                icon: <Trash2 size={20} />,
                label: "Retirer l'exercice",
                danger: true,
                onClick: () => (update({ exercises: routine.exercises.filter((e) => e.uid !== menuEx.uid) }), setMenu(null)),
              },
            ]}
          />
        )}
      </Sheet>

      <SetTypeSheet
        open={!!setMenuTarget}
        onClose={() => setSetMenuTarget(null)}
        onPick={(t) => {
          if (setMenuTarget) updateEx(setMenuTarget.ex, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === setMenuTarget.idx ? { ...s, type: t } : s)) }))
          setSetMenuTarget(null)
        }}
        onDelete={() => {
          if (setMenuTarget) updateEx(setMenuTarget.ex, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== setMenuTarget.idx) }))
          setSetMenuTarget(null)
        }}
      />
      {reordering && <ReorderExercises exercises={routine.exercises} exMap={exMap} onReorder={(exercises) => update({ exercises })} onClose={() => setReordering(false)} />}
    </Page>
  )
}
