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

export const PROFILE_COLORS = ['#D6B56E', '#D98FA8', '#6FAFC9', '#E0A458', '#A58AD0', '#E06B62']

/** Couleurs de l'ancienne charte → nouvelle palette (profils déjà créés) */
const LEGACY_COLORS: Record<string, string> = { '#a3e635': '#D6B56E', '#f472b6': '#D98FA8', '#38bdf8': '#6FAFC9', '#fbbf24': '#E0A458', '#a78bfa': '#A58AD0', '#fb7185': '#E06B62' }

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
  return list.length ? list.map((p) => ({ ...p, color: LEGACY_COLORS[p.color] ?? p.color })) : [{ id: DEFAULT_PROFILE_ID, name: 'Moi', color: PROFILE_COLORS[0] }]
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
