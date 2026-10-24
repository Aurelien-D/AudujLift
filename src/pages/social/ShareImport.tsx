import { Copy, Download, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SolarSigil } from '../../components/SolarSigil'
import { Button, Card, EmptyState, Page } from '../../components/ui'
import { formatSet } from '../../components/workout-parts'
import { db } from '../../lib/db'
import { MUSCLE_LABELS } from '../../lib/exercises-data'
import { recordFriend } from '../../lib/friends'
import { activeProfile } from '../../lib/profiles'
import { decodeShare, planImport, sharedRoutineExercises, type SharePayload } from '../../lib/share'
import { uid } from '../../lib/utils'

/** L'appli tourne-t-elle comme appli installée (écran d'accueil) ? */
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export default function ShareImport() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const code = params.get('d') ?? ''
  const [payload, setPayload] = useState<SharePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const standalone = isStandalone()

  useEffect(() => {
    decodeShare(code).then(setPayload, (e) => setError((e as Error).message))
  }, [code])

  const importIt = async () => {
    if (!payload) return
    setBusy(true)
    const id = uid()
    await db.transaction('rw', db.exercises, db.routines, async () => {
      const { mapping, toCreate } = planImport(payload, await db.exercises.toArray())
      if (toCreate.length) await db.exercises.bulkPut(toCreate)
      const now = Date.now()
      await db.routines.add({
        id,
        name: payload.routine.name,
        folder: `De ${payload.from}`,
        sharedBy: payload.from,
        exercises: sharedRoutineExercises(payload, mapping, uid),
        createdAt: now,
        updatedAt: now,
      })
    })
    await recordFriend(payload.from, 'received')
    navigate(`/workouts/routine/${id}`, { replace: true })
  }

  if (error)
    return (
      <Page back="/" title="Routine partagée">
        <EmptyState title="Lien inutilisable">{error}</EmptyState>
      </Page>
    )
  if (!payload)
    return (
      <Page back="/" title="Routine partagée">
        {null}
      </Page>
    )

  const sets = payload.routine.exercises.reduce((n, e) => n + e.sets.length, 0)
  return (
    <Page back="/" title="Routine partagée">
      <Card glow className="relative overflow-hidden">
        <SolarSigil size={110} className="pointer-events-none absolute -top-6 -right-6 text-gold/[0.07]" />
        <div className="label text-gold">{payload.from} te partage</div>
        <h2 className="mt-1 text-2xl font-semibold">{payload.routine.name}</h2>
        <p className="mt-1 text-sm text-silver">
          {payload.routine.exercises.length} exercices · {sets} séries
        </p>
      </Card>

      {!standalone && (
        <Card className="mt-3 border-warn/30">
          <div className="flex gap-3 text-sm">
            <Info size={18} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <p className="text-ivory">Tu as ouvert le lien dans le navigateur.</p>
              <p className="mt-1 text-silver">
                Si AudujLift est installée sur ton écran d'accueil, copie le lien puis ouvre l'appli → <b>Séances → Amis → Coller le lien</b> : sur iPhone, le navigateur et l'appli
                installée ne partagent pas leurs données.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={async () => {
                  await navigator.clipboard?.writeText(location.href).catch(() => prompt('Copie ce lien :', location.href))
                  setCopied(true)
                }}
              >
                <Copy size={16} /> {copied ? 'Lien copié' : 'Copier le lien'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="mt-3 divide-y divide-line/50 p-0">
        {payload.routine.exercises.map((e, i) => (
          <div key={i} className="px-4 py-2.5">
            <div className="font-medium">{e.exercise.name}</div>
            <div className="text-xs text-silver">
              {MUSCLE_LABELS[e.exercise.muscle] ?? ''} · {e.sets.length} × {e.sets.map((s) => formatSet(s, e.exercise.kind).replace(/^0 kg × /, '')).join(', ')}
            </div>
            {e.notes && <div className="mt-0.5 text-xs text-gold-pale/80">{e.notes}</div>}
          </div>
        ))}
      </Card>

      <Button variant="primary" size="lg" className="mt-4 w-full" disabled={busy} onClick={importIt}>
        <Download size={18} /> Ajouter à mes routines
      </Button>
      <p className="mt-2 text-center text-xs text-silver-dim">Ajoutée au profil « {activeProfile().name} ». Les charges se rempliront avec ton propre historique.</p>
    </Page>
  )
}
