// Partage de routines par lien : la routine est compressée dans l'adresse elle-même.
// Aucun serveur : le lien voyage par SMS, WhatsApp, AirDrop… et s'importe sur le téléphone de l'ami.
import type { Exercise, Routine, RoutineExercise, SetData } from './types'
import { normalize } from './utils'

export const SHARE_VERSION = 1

/** Définition minimale d'un exercice (pour recréer chez l'ami un exercice perso qu'il n'a pas). */
export type SharedExercise = Pick<Exercise, 'id' | 'name' | 'muscle' | 'secondary' | 'equipment' | 'kind'> & Partial<Pick<Exercise, 'ref' | 'standard' | 'guideId' | 'notes'>>

export interface SharePayload {
  v: number
  /** Prénom de l'expéditeur */
  from: string
  routine: {
    name: string
    exercises: { exercise: SharedExercise; sets: SetData[]; restSec: number; notes?: string; supersetId?: string }[]
  }
}

export function buildSharePayload(routine: Routine, exercises: Map<string, Exercise>, from: string): SharePayload {
  return {
    v: SHARE_VERSION,
    from: from.trim() || 'Un ami',
    routine: {
      name: routine.name,
      exercises: routine.exercises.map((re) => {
        const ex = exercises.get(re.exerciseId)
        const exercise: SharedExercise = ex
          ? {
              id: ex.id,
              name: ex.name,
              muscle: ex.muscle,
              secondary: ex.secondary,
              equipment: ex.equipment,
              kind: ex.kind,
              ...(ex.custom ? { ref: ex.ref, standard: ex.standard, guideId: ex.guideId, notes: ex.notes } : {}),
            }
          : { id: re.exerciseId, name: 'Exercice', muscle: 'corps-entier', secondary: [], equipment: 'autre', kind: 'weight_reps' }
        // Les charges sont propres à chacun : on ne partage que la structure (séries, reps, durées)
        const sets = re.sets.map(({ type, reps, duration, distance }) => ({ type, reps, duration, distance }))
        return { exercise, sets, restSec: re.restSec, notes: re.notes, supersetId: re.supersetId }
      }),
    },
  }
}

// ---------- Encodage (JSON → deflate → base64url) ----------

const toB64Url = (bytes: Uint8Array) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64Url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

/** « z… » = compressé, « j… » = JSON brut (navigateurs sans CompressionStream). */
export async function encodeShare(p: SharePayload): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(p))
  if (typeof CompressionStream !== 'undefined') return 'z' + toB64Url(await pipe(json, new CompressionStream('deflate-raw')))
  return 'j' + toB64Url(json)
}

export async function decodeShare(code: string): Promise<SharePayload> {
  const c = code.trim()
  let bytes: Uint8Array
  try {
    if (c[0] === 'z') bytes = await pipe(fromB64Url(c.slice(1)), new DecompressionStream('deflate-raw'))
    else if (c[0] === 'j') bytes = fromB64Url(c.slice(1))
    else throw new Error()
  } catch {
    throw new Error('Lien de partage illisible ou incomplet.')
  }
  const p = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload
  if (!p || typeof p.v !== 'number' || !p.routine?.name || !Array.isArray(p.routine.exercises)) throw new Error('Ce lien ne contient pas de routine AudujLift.')
  if (p.v > SHARE_VERSION) throw new Error('Ce lien vient d’une version plus récente de l’appli : mets-la à jour.')
  return p
}

/** Lien complet vers l'écran d'import de l'appli. */
export function shareUrl(code: string, base = `${location.origin}${location.pathname}`): string {
  return `${base}#/share?d=${code}`
}

/** Extrait le code d'un lien collé (ou d'un code seul). */
export function extractShareCode(text: string): string | null {
  const m = /[?&]d=([zj][A-Za-z0-9_-]+)/.exec(text) ?? /^\s*([zj][A-Za-z0-9_-]{8,})\s*$/.exec(text)
  return m ? m[1] : null
}

// ---------- Import ----------

/**
 * Prépare l'import : chaque exercice reçu est relié à un exercice existant (même identifiant, ou même nom
 * parmi tes exercices perso), sinon il sera créé comme exercice perso.
 */
export function planImport(p: SharePayload, mine: Exercise[]): { mapping: Map<string, string>; toCreate: Exercise[] } {
  const byId = new Map(mine.map((e) => [e.id, e]))
  const byName = new Map(mine.map((e) => [normalize(e.name), e]))
  const mapping = new Map<string, string>()
  const toCreate: Exercise[] = []
  for (const { exercise: x } of p.routine.exercises) {
    if (mapping.has(x.id)) continue
    const same = byId.get(x.id) ?? byName.get(normalize(x.name))
    if (same) {
      mapping.set(x.id, same.id)
      continue
    }
    const id = x.id.startsWith('custom-') ? x.id : `custom-${x.id}`
    toCreate.push({ ...x, id, secondary: x.secondary ?? [], custom: true })
    mapping.set(x.id, id)
    byName.set(normalize(x.name), toCreate[toCreate.length - 1])
  }
  return { mapping, toCreate }
}

export function sharedRoutineExercises(p: SharePayload, mapping: Map<string, string>, newUid: () => string): RoutineExercise[] {
  return p.routine.exercises.map((e) => ({
    uid: newUid(),
    exerciseId: mapping.get(e.exercise.id) ?? e.exercise.id,
    sets: e.sets,
    restSec: e.restSec,
    notes: e.notes,
    supersetId: e.supersetId,
  }))
}
