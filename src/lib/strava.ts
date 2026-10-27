// Publication des séances sur Strava (API v3), sans serveur. Chacun déclare sa propre application Strava
// (gratuite) et colle son Client ID / Client Secret dans le profil : les jetons sont échangés directement depuis
// le téléphone (Strava autorise ces appels depuis un navigateur). Tout reste sur l'appareil, hors sauvegardes.
import { db } from './db'
import { e1rm, workoutTotals, type PRHit } from './stats'
import type { Exercise, Workout, WorkoutSet } from './types'
import { formatDuration, formatNumber } from './utils'

export interface StravaConfig {
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
  /** Expiration du jeton d'accès (secondes Unix) */
  expiresAt?: number
  /** Prénom et nom du compte connecté */
  athlete?: string
  /** Publier automatiquement chaque séance terminée */
  auto?: boolean
}

/** Une connexion par profil (deux personnes peuvent partager le téléphone). */
const storageKey = () => `audujlift.strava.${db.name}`
export const OAUTH_STATE = 'audujlift-strava'

export function stravaConfig(): StravaConfig | null {
  try {
    return JSON.parse(localStorage.getItem(storageKey()) ?? 'null') as StravaConfig | null
  } catch {
    return null
  }
}
export function saveStravaConfig(c: StravaConfig) {
  localStorage.setItem(storageKey(), JSON.stringify(c))
}
export const isStravaConnected = (c: StravaConfig | null): c is StravaConfig & { refreshToken: string } => !!c?.refreshToken

/** Adresse de retour après l'autorisation : la page de l'appli, sans le « # » (Strava y ajoute ?code=…). */
export const redirectUri = () => `${location.origin}${location.pathname}`

export function authorizeUrl(clientId: string): string {
  const q = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:write',
    state: OAUTH_STATE,
  })
  return `https://www.strava.com/oauth/authorize?${q}`
}

/**
 * Retour de Strava (?code=…&scope=…&state=…) : on réécrit l'adresse vers le profil avant le démarrage du routeur,
 * pour que l'écran Strava du profil termine la connexion (ou affiche le code à copier si on est dans un autre
 * navigateur que l'appli installée, comme sur iPhone).
 */
export function consumeStravaRedirect() {
  const q = new URLSearchParams(location.search)
  if (q.get('state') !== OAUTH_STATE) return
  const code = q.get('code')
  const scopeOk = (q.get('scope') ?? '').split(',').includes('activity:write')
  const hash = q.get('error') || !code ? 'strava_error=refus' : !scopeOk ? 'strava_error=scope' : `strava_code=${encodeURIComponent(code)}`
  history.replaceState(null, '', `${location.pathname}#/profile?${hash}`)
}

async function stravaFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new Error('Pas de connexion internet : réessaie plus tard.')
  }
}

async function errorMessage(res: Response): Promise<string> {
  if (res.status === 401) return 'Connexion Strava refusée ou expirée : reconnecte Strava dans Profil.'
  if (res.status === 429) return 'Strava limite le nombre de requêtes : réessaie dans un quart d’heure.'
  try {
    const body = (await res.json()) as { message?: string; errors?: { field?: string; code?: string }[] }
    const detail = body.errors?.map((e) => [e.field, e.code].filter(Boolean).join(' ')).join(', ')
    return `Strava : ${body.message ?? res.statusText}${detail ? ` (${detail})` : ''}`
  } catch {
    return `Strava : erreur ${res.status}`
  }
}

async function tokenRequest(c: StravaConfig, params: Record<string, string>): Promise<StravaConfig> {
  const res = await stravaFetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: c.clientId.trim(), client_secret: c.clientSecret.trim(), ...params }),
  })
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) throw new Error('Strava refuse la connexion : vérifie le Client ID et le Client Secret.')
    throw new Error(await errorMessage(res))
  }
  const t = (await res.json()) as { access_token: string; refresh_token: string; expires_at: number; athlete?: { firstname?: string; lastname?: string } }
  const athlete = t.athlete ? [t.athlete.firstname, t.athlete.lastname].filter(Boolean).join(' ') : c.athlete
  const next: StravaConfig = { ...c, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at, athlete }
  saveStravaConfig(next)
  return next
}

/** Termine la connexion avec le code renvoyé par Strava. */
export async function connectStrava(code: string): Promise<StravaConfig> {
  const c = stravaConfig()
  if (!c?.clientId || !c.clientSecret) throw new Error('Renseigne d’abord le Client ID et le Client Secret.')
  return tokenRequest(c, { code: code.trim(), grant_type: 'authorization_code' })
}

async function validToken(): Promise<string> {
  let c = stravaConfig()
  if (!isStravaConnected(c)) throw new Error('Strava n’est pas connecté : va dans Profil → Strava.')
  if (!c.accessToken || (c.expiresAt ?? 0) - 120 < Date.now() / 1000) c = await tokenRequest(c, { refresh_token: c.refreshToken, grant_type: 'refresh_token' })
  return c.accessToken!
}

/** Déconnexion : révoque l'accès côté Strava (si possible) et efface tout du téléphone. */
export async function disconnectStrava() {
  const c = stravaConfig()
  if (c?.accessToken) await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', body: new URLSearchParams({ access_token: c.accessToken }) }).catch(() => {})
  localStorage.removeItem(storageKey())
}

/** Date locale sans fuseau, attendue par Strava (start_date_local). */
export function localISO(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** Crée l'activité « Musculation » et renvoie son identifiant Strava. */
export async function publishWorkout(w: Workout, description: string): Promise<number> {
  const token = await validToken()
  const res = await stravaFetch('https://www.strava.com/api/v3/activities', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: w.name,
      sport_type: 'WeightTraining',
      start_date_local: localISO(w.startedAt),
      elapsed_time: Math.max(60, Math.round(((w.endedAt ?? Date.now()) - w.startedAt) / 1000)),
      description,
    }),
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  const { id } = (await res.json()) as { id: number }
  await db.workouts.update(w.id, { stravaId: id })
  return id
}

export const stravaActivityUrl = (id: number) => `https://www.strava.com/activities/${id}`

// ---------- Description de l'activité ----------

function bestSetLabel(sets: WorkoutSet[], ex?: Exercise): string {
  const work = sets.filter((s) => s.type !== 'warmup')
  const list = work.length ? work : sets
  const kind = ex?.kind ?? 'weight_reps'
  if (kind === 'duration') {
    const sec = Math.max(...list.map((s) => s.duration ?? 0))
    return sec >= 60 ? `${Math.floor(sec / 60)} min${sec % 60 ? ` ${sec % 60} s` : ''}` : `${sec} s`
  }
  if (kind === 'cardio') {
    const km = list.reduce((n, s) => n + (s.distance ?? 0), 0)
    const min = Math.round(list.reduce((n, s) => n + (s.duration ?? 0), 0) / 60)
    return [km ? `${formatNumber(km, 2)} km` : '', min ? `${min} min` : ''].filter(Boolean).join(' · ')
  }
  const best = list.reduce<WorkoutSet | undefined>((b, s) => (!b || e1rm(s.weight || 1, s.reps ?? 0) > e1rm(b.weight || 1, b.reps ?? 0) ? s : b), undefined)
  if (!best) return ''
  if (!best.weight) return `${best.reps ?? 0} reps`
  return `${formatNumber(best.weight)} kg × ${best.reps ?? 0}`
}

export function stravaDescription(w: Workout, exMap: Map<string, Exercise>, prs: PRHit[], promotions: string[] = []): string {
  const totals = workoutTotals(w, exMap)
  const lines = w.exercises
    .filter((e) => e.sets.length)
    .map((e) => {
      const ex = exMap.get(e.exerciseId)
      const n = e.sets.filter((s) => s.type !== 'warmup').length || e.sets.length
      const best = bestSetLabel(e.sets, ex)
      return `• ${ex?.name ?? 'Exercice'} : ${n} série${n > 1 ? 's' : ''}${best ? ` · ${best}` : ''}`
    })
  const out = [...lines, '', `${totals.sets} série${totals.sets > 1 ? 's' : ''} · ${formatNumber(totals.volume, 0)} kg soulevés · ${formatDuration(totals.durationMs)}`]
  if (prs.length)
    out.push('', `🏆 ${prs.length} record${prs.length > 1 ? 's' : ''} : ${prs.map((p) => `${exMap.get(p.exerciseId)?.name ?? ''} (${p.label} ${p.value})`).join(', ')}`)
  if (promotions.length) out.push(`⬆️ ${promotions.join(', ')}`)
  out.push('', 'Enregistré avec AudujLift')
  return out.join('\n')
}
