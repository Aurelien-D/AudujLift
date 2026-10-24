import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Copy, Dumbbell, History as HistoryIcon, LayoutTemplate, MoreVertical, Pencil, Play, Plus, Share2, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShareRoutineSheet } from '../../components/ShareRoutine'
import { SortableList } from '../../components/SortableList'
import { ActionList, Button, Card, EmptyState, IconButton, Page, SectionTitle, Sheet } from '../../components/ui'
import { db } from '../../lib/db'
import { useActiveWorkout, useExerciseMap } from '../../lib/hooks'
import type { Routine } from '../../lib/types'
import { formatShortDate, uid } from '../../lib/utils'
import { estimateDurationMin } from '../../lib/progression'
import { applyFolderOrder, sortRoutines } from '../../lib/routine-order'
import { startWorkout } from '../../lib/workout'

export function useStartWorkout() {
  const navigate = useNavigate()
  const active = useActiveWorkout()
  return async (routine?: Routine) => {
    if (active && !confirm(`Une séance est déjà en cours (« ${active.name} »). La reprendre ?`)) return
    await startWorkout(routine)
    navigate('/workout/active')
  }
}

export default function Workouts() {
  const navigate = useNavigate()
  const routines = useLiveQuery(async () => sortRoutines(await db.routines.toArray()), [])
  const exMap = useExerciseMap()
  const active = useActiveWorkout()
  const start = useStartWorkout()
  const [menu, setMenu] = useState<Routine | null>(null)
  const [sharing, setSharing] = useState<Routine | null>(null)

  const duplicate = async (r: Routine) => {
    const now = Date.now()
    await db.routines.add({ ...r, id: uid(), name: `${r.name} (copie)`, createdAt: now, updatedAt: now, lastUsedAt: undefined, order: undefined })
    setMenu(null)
  }
  const remove = async (r: Routine) => {
    if (!confirm(`Supprimer la routine « ${r.name} » ?`)) return
    await db.routines.delete(r.id)
    setMenu(null)
  }
  // Glisser-déposer dans un dossier : toutes les routines reçoivent leur rang (sans toucher à updatedAt)
  const reorder = async (list: Routine[]) => {
    const ids = applyFolderOrder(
      routines ?? [],
      list.map((r) => r.id),
    )
    await db.transaction('rw', db.routines, () => Promise.all(ids.map((id, order) => db.routines.update(id, { order }))))
  }

  const folders = new Map<string, Routine[]>()
  for (const r of routines ?? []) {
    const k = r.folder?.trim() || 'Mes routines'
    folders.set(k, [...(folders.get(k) ?? []), r])
  }

  return (
    <Page
      title="Entraînement"
      actions={
        <>
          <IconButton aria-label="Historique" onClick={() => navigate('/workouts/history')}>
            <HistoryIcon size={22} />
          </IconButton>
          <IconButton aria-label="Exercices" onClick={() => navigate('/exercises')}>
            <BookOpen size={22} />
          </IconButton>
          <IconButton aria-label="Amis" onClick={() => navigate('/friends')}>
            <Users size={22} />
          </IconButton>
        </>
      }
    >
      {active ? (
        <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/workout/active')}>
          <Play size={20} /> Reprendre « {active.name} »
        </Button>
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={() => start()}>
          <Plus size={20} /> Démarrer une séance libre
        </Button>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          { label: 'Nouvelle routine', icon: Plus, to: '/workouts/routine/new' },
          { label: 'Programmes', icon: LayoutTemplate, to: '/workouts/programs' },
          { label: 'Exercices', icon: Dumbbell, to: '/exercises' },
          { label: 'Amis', icon: Users, to: '/friends' },
        ].map(({ label, icon: Icon, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="press flex flex-col items-center gap-1.5 rounded-2xl border border-line/70 bg-surface py-3 text-xs font-medium text-ivory-dim active:bg-raised"
          >
            <Icon size={20} strokeWidth={1.75} className="text-gold" />
            {label}
          </button>
        ))}
      </div>

      {routines?.length === 0 && (
        <div className="mt-6">
          <EmptyState title="Aucune routine pour l'instant">
            Crée ta propre routine ou importe un programme tout prêt (PPL, Haut/Bas, Full Body).
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/workouts/programs')}>
                Voir les programmes
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/workouts/routine/new')}>
                Créer une routine
              </Button>
            </div>
          </EmptyState>
        </div>
      )}

      {[...folders.entries()].map(([folder, list]) => (
        <div key={folder}>
          <SectionTitle>
            {folder} <span className="text-silver-dim">({list.length})</span>
          </SectionTitle>
          <SortableList
            className="space-y-3"
            items={list}
            keyOf={(r) => r.id}
            labelOf={(r) => r.name}
            onReorder={reorder}
            renderItem={(r, handle) => (
              <Card>
                <div className="flex items-start gap-2">
                  <div className="-mt-1.5">{handle}</div>
                  <div className="min-w-0 flex-1" onClick={() => navigate(`/workouts/routine/${r.id}`)}>
                    <h3 className="truncate text-base font-semibold">
                      {r.name}
                      {r.sharedBy && <span className="ml-2 rounded-full border border-gold/40 px-2 py-0.5 align-middle text-[11px] font-normal text-gold">de {r.sharedBy}</span>}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-silver">{r.exercises.map((e) => exMap.get(e.exerciseId)?.name ?? '?').join(', ') || 'Aucun exercice'}</p>
                    <p className="mt-1 text-xs text-silver">
                      {r.exercises.length} exercices · {r.exercises.reduce((n, e) => n + e.sets.length, 0)} séries · ~{estimateDurationMin(r.exercises)} min
                      {r.lastUsedAt && ` · dernière fois le ${formatShortDate(r.lastUsedAt)}`}
                    </p>
                  </div>
                  <IconButton aria-label="Options" onClick={() => setMenu(r)} className="-mt-1 -mr-2">
                    <MoreVertical size={20} />
                  </IconButton>
                </div>
                <Button variant="secondary" className="mt-3 w-full" onClick={() => start(r)}>
                  <Play size={18} className="text-gold" /> Démarrer
                </Button>
              </Card>
            )}
          />
        </div>
      ))}

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        {menu && (
          <ActionList
            items={[
              { icon: <Pencil size={20} />, label: 'Modifier', onClick: () => navigate(`/workouts/routine/${menu.id}`) },
              { icon: <Share2 size={20} />, label: 'Partager avec un ami', onClick: () => (setSharing(menu), setMenu(null)) },
              { icon: <Copy size={20} />, label: 'Dupliquer', onClick: () => duplicate(menu) },
              { icon: <Trash2 size={20} />, label: 'Supprimer', onClick: () => remove(menu), danger: true },
            ]}
          />
        )}
      </Sheet>
      {sharing && <ShareRoutineSheet routine={sharing} onClose={() => setSharing(null)} />}
    </Page>
  )
}
