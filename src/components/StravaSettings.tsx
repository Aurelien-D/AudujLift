import { Check, Copy, ExternalLink, Link2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authorizeUrl, connectStrava, disconnectStrava, isStravaConnected, saveStravaConfig, stravaConfig, type StravaConfig } from '../lib/strava'
import { Button, Field, inputClass, Toggle } from './ui'

/** Couleur de la marque Strava, utilisée seulement pour les boutons qui y mènent. */
export const STRAVA_ORANGE = '#FC4C02'

function CopyValue({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
      className="press inline-flex max-w-full items-center gap-1.5 rounded-lg bg-ink px-2 py-1 font-mono text-xs text-ivory-dim"
    >
      <span className="truncate">{value}</span>
      {done ? <Check size={13} className="shrink-0 text-success" /> : <Copy size={13} className="shrink-0" />}
    </button>
  )
}

/** Section « Strava » du profil : création de l'application Strava, connexion, publication automatique. */
export function StravaSettings() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [cfg, setCfg] = useState<StravaConfig | null>(() => stravaConfig())
  const [clientId, setClientId] = useState(cfg?.clientId ?? '')
  const [clientSecret, setClientSecret] = useState(cfg?.clientSecret ?? '')
  const [code, setCode] = useState('')
  // Retour de Strava (adresse réécrite par consumeStravaRedirect) : lu une seule fois, à l'ouverture
  const [back] = useState(() => ({ code: params.get('strava_code'), error: params.get('strava_error'), canExchange: !!stravaConfig()?.clientSecret }))
  const [busy, setBusy] = useState(!!back.code && back.canExchange)
  const [error, setError] = useState<string | null>(() =>
    back.error ? (back.error === 'scope' ? 'Coche « Importer vos activités » sur la page Strava pour autoriser la publication.' : 'Connexion à Strava annulée.') : null,
  )
  // Autorisation faite dans le navigateur, sans les codes de l'appli : on affiche le code à coller dans l'appli installée
  const orphanCode = back.code && !back.canExchange ? back.code : null
  const handled = useRef(false)

  const finish = async (c: string) => {
    setBusy(true)
    setError(null)
    try {
      setCfg(await connectStrava(c))
      setCode('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Retour de Strava : on nettoie l'adresse et on termine la connexion
  useEffect(() => {
    if (handled.current || (!back.code && !back.error)) return
    handled.current = true
    if (!orphanCode) navigate('/profile', { replace: true })
    if (back.code && back.canExchange)
      connectStrava(back.code)
        .then(setCfg, (e: Error) => setError(e.message))
        .finally(() => setBusy(false))
  }, [back, orphanCode, navigate])

  const idValid = /^\d{3,10}$/.test(clientId.trim())
  const secretValid = /^[0-9a-f]{40}$/i.test(clientSecret.trim())

  const connect = () => {
    const next = { ...(cfg ?? {}), clientId: clientId.trim(), clientSecret: clientSecret.trim() }
    saveStravaConfig(next)
    location.href = authorizeUrl(next.clientId)
  }

  if (orphanCode)
    return (
      <div className="space-y-3 text-sm">
        <p className="text-ivory">Strava a bien autorisé l'appli. Dernière étape :</p>
        <p className="text-silver">
          Tu es dans le navigateur, pas dans l'appli installée (sur iPhone, ils ne partagent pas leurs données). Copie ce code, ouvre l'appli AudujLift depuis l'écran d'accueil,
          puis colle-le dans Profil → Strava → « J'ai un code ».
        </p>
        <CopyValue value={orphanCode} />
        <p className="text-xs text-silver-dim">Le code n'est valable que quelques minutes.</p>
      </div>
    )

  if (isStravaConnected(cfg))
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-silver">
            Connecté{cfg.athlete ? ' : ' : ''}
            <span className="text-ivory-dim">{cfg.athlete}</span>
          </span>
          <Button
            variant="tertiary"
            size="sm"
            onClick={async () => {
              if (!confirm('Déconnecter Strava de ce téléphone ? Les activités déjà publiées restent sur Strava.')) return
              await disconnectStrava()
              setCfg(null)
              setClientId('')
              setClientSecret('')
            }}
          >
            Déconnecter
          </Button>
        </div>
        <Toggle
          checked={!!cfg.auto}
          onChange={(auto) => {
            const next = { ...cfg, auto }
            saveStravaConfig(next)
            setCfg(next)
          }}
          label="Publier automatiquement"
          hint="Chaque séance terminée part sur Strava (sinon : bouton « Publier sur Strava » sur le récapitulatif)."
        />
      </div>
    )

  return (
    <div className="space-y-3 text-sm">
      <p className="text-silver">Publie tes séances sur ton feed Strava (activité « Musculation » avec le détail des exercices). Réglage unique, environ 5 minutes :</p>
      <p className="rounded-xl border border-line/70 px-3 py-2 text-xs text-silver">
        Depuis juin 2026, Strava réserve son API aux abonnés Strava. Sans abonnement, utilise « Copier pour Strava » sur le récapitulatif d'une séance et colle le texte dans une
        activité manuelle.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-silver">
        <li>
          Ouvre{' '}
          <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-gold underline">
            strava.com/settings/api <ExternalLink size={11} />
          </a>{' '}
          (connecté à ton compte) et crée une application :
          <ul className="mt-1 space-y-1 text-xs">
            <li>Nom : AudujLift · Catégorie : Training</li>
            <li>
              Site web : <CopyValue value={`${location.origin}${location.pathname}`} />
            </li>
            <li>
              Authorization Callback Domain : <CopyValue value={location.hostname} />
            </li>
          </ul>
        </li>
        <li>Copie ci-dessous le « Client ID » et le « Client Secret » affichés par Strava.</li>
        <li>Appuie sur « Connecter Strava » et accepte.</li>
      </ol>
      <div className="grid grid-cols-[2fr_3fr] gap-2">
        <Field label="Client ID">
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} inputMode="numeric" placeholder="123456" className={inputClass} />
        </Field>
        <Field label="Client Secret">
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="40 caractères"
            className={inputClass}
          />
        </Field>
      </div>
      <p className="text-xs text-silver-dim">Ces codes restent uniquement sur ce téléphone (jamais dans les sauvegardes). Chaque personne crée sa propre application Strava.</p>
      <Button className="w-full text-white" style={{ background: STRAVA_ORANGE }} disabled={!idValid || !secretValid || busy} onClick={connect}>
        <Link2 size={18} /> Connecter Strava
      </Button>
      {cfg?.clientSecret && (
        <details className="text-xs text-silver">
          <summary className="cursor-pointer">J'ai un code (autorisation faite dans le navigateur)</summary>
          <div className="mt-2 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="none" placeholder="Code Strava" className={inputClass} />
            <Button variant="secondary" disabled={code.trim().length < 10 || busy} onClick={() => finish(code)}>
              Valider
            </Button>
          </div>
        </details>
      )}
      {busy && <p className="text-xs text-silver">Connexion à Strava…</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
