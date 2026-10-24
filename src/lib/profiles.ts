// Plusieurs profils sur le même appareil : chaque profil a sa propre base IndexedDB,
// les données des uns ne peuvent donc jamais écraser celles des autres.
import Dexie from 'dexie'
import { uid } from './utils'

export interface Profile {
  id: string
  name: string
  color: string
}

const LIST_KEY = 'audujlift.profiles'
const ACTIVE_KEY = 'audujlift.activeProfile'
/** Le premier profil réutilise la base d'origine, pour conserver les données existantes. */
export const DEFAULT_PROFILE_ID = 'default'

export const PROFILE_COLORS = ['#a3e635', '#f472b6', '#38bdf8', '#fbbf24', '#a78bfa', '#fb7185']

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

export function listProfiles(): Profile[] {
  const list = read<Profile[]>(LIST_KEY, [])
  return list.length ? list : [{ id: DEFAULT_PROFILE_ID, name: 'Moi', color: PROFILE_COLORS[0] }]
}

function saveProfiles(list: Profile[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(list))
}

export function activeProfileId(): string {
  const id = read<string>(ACTIVE_KEY, DEFAULT_PROFILE_ID)
  return listProfiles().some((p) => p.id === id) ? id : listProfiles()[0].id
}

export function activeProfile(): Profile {
  return listProfiles().find((p) => p.id === activeProfileId())!
}

export function dbNameFor(profileId: string): string {
  return profileId === DEFAULT_PROFILE_ID ? 'audujlift' : `audujlift-${profileId}`
}

/** Change de profil : la page est rechargée pour ouvrir la base du profil choisi. */
export function switchProfile(id: string) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(id))
  localStorage.removeItem('audujlift.restTimer')
  location.hash = '#/'
  location.reload()
}

export function createProfile(name: string): Profile {
  const list = listProfiles()
  const profile: Profile = { id: uid().slice(0, 12), name: name.trim(), color: PROFILE_COLORS[list.length % PROFILE_COLORS.length] }
  saveProfiles([...list, profile])
  return profile
}

export function renameProfile(id: string, name: string) {
  if (!name.trim()) return
  saveProfiles(listProfiles().map((p) => (p.id === id ? { ...p, name: name.trim() } : p)))
}

/** Supprime un profil et toutes ses données (impossible pour le profil actif ou le dernier profil). */
export async function deleteProfile(id: string) {
  const list = listProfiles()
  if (id === activeProfileId() || list.length <= 1) throw new Error('Impossible de supprimer ce profil')
  await Dexie.delete(dbNameFor(id))
  saveProfiles(list.filter((p) => p.id !== id))
}
