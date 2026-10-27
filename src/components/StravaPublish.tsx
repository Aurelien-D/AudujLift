import { Check, Copy, ExternalLink, Loader2, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDoneWorkouts, useExercises, useRankBody } from '../lib/hooks'
import { rankChanges, rankSnapshot } from '../lib/rank-standards'
import type { PRHit } from '../lib/stats'
import { isStravaConnected, publishWorkout, stravaActivityUrl, stravaConfig, stravaDescription } from '../lib/strava'
import type { Exercise, Workout } from '../lib/types'
import { STRAVA_ORANGE } from './StravaSettings'
import { Button } from './ui'

// Séances en cours de publication (évite un doublon si l'écran se monte deux fois)
const inFlight = new Set<string>()

/** Bouton « Publier sur Strava » d'une séance terminée (et publication automatique si elle est activée). */
export function StravaPublish({ workout, exMap, prs, summary }: { workout: Workout; exMap: Map<string, Exercise>; prs: PRHit[]; summary: boolean }) {
  const navigate = useNavigate()
  const cfg = useMemo(() => stravaConfig(), [])
  const connected = isStravaConnected(cfg)
  const exercises = useExercises()
  const all = useDoneWorkouts()
  const body = useRankBody()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const autoTried = useRef(false)

  // Promotions de rang de la séance, pour la description
  const promotions = useMemo(() => {
    if (!exercises || !all || !body) return undefined
    const others = all.filter((w) => w.id !== workout.id)
    return rankChanges(workout, rankSnapshot(exercises, others, body), rankSnapshot(exercises, [...others, workout], body))
      .filter((c) => c.change === 'up')
      .map((c) => `${c.now.ex.name} : ${c.now.rank.label}`)
  }, [exercises, all, body, workout])
  const ready = promotions !== undefined || body === null

  const publish = async () => {
    if (inFlight.has(workout.id)) return
    inFlight.add(workout.id)
    setBusy(true)
    setError(null)
    try {
      await publishWorkout(workout, stravaDescription(workout, exMap, prs, promotions ?? []))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      inFlight.delete(workout.id)
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!summary || !connected || !cfg?.auto || workout.stravaId || !ready || autoTried.current) return
    autoTried.current = true
    void publish()
  })

  if (workout.stravaId)
    return (
      <a
        href={stravaActivityUrl(workout.stravaId)}
        target="_blank"
        rel="noreferrer"
        className="press mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl border text-[15px] font-medium"
        style={{ color: STRAVA_ORANGE, borderColor: `${STRAVA_ORANGE}66` }}
      >
        Publiée sur Strava · voir <ExternalLink size={16} />
      </a>
    )

  // Sans connexion (l'API Strava demande un abonnement Strava) : le texte à coller dans une activité manuelle
  if (!connected)
    return (
      <div className="mt-3">
        <Button
          variant="outline"
          className="w-full"
          style={{ color: STRAVA_ORANGE, borderColor: `${STRAVA_ORANGE}66` }}
          disabled={!ready}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${workout.name}\n\n${stravaDescription(workout, exMap, prs, promotions ?? [])}`)
              setCopied(true)
            } catch {
              setError('Copie impossible sur ce navigateur.')
            }
          }}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copié !' : 'Copier pour Strava'}
        </Button>
        {copied && (
          <p className="mt-1.5 text-xs text-silver">
            Dans Strava, ajoute une activité manuelle « Musculation » et colle le texte dans la description.{' '}
            <button onClick={() => navigate('/profile')} className="underline">
              Publication directe
            </button>{' '}
            : avec un abonnement Strava.
          </p>
        )}
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      </div>
    )

  return (
    <div className="mt-3">
      <Button className="w-full text-white" style={{ background: STRAVA_ORANGE }} disabled={busy || !ready} onClick={publish}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        {busy ? 'Publication…' : 'Publier sur Strava'}
      </Button>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  )
}
