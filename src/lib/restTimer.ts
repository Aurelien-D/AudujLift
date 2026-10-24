import { useSyncExternalStore } from 'react'

// Minuteur de repos global : survit aux changements de page et au rechargement.
interface TimerState {
  endAt: number | null
  total: number
}

const KEY = 'audujlift.restTimer'
let state: TimerState = load()
const listeners = new Set<() => void>()
let timeout: ReturnType<typeof setTimeout> | undefined

function load(): TimerState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '') as TimerState
    if (s.endAt && s.endAt > Date.now()) return s
  } catch {
    /* rien */
  }
  return { endAt: null, total: 0 }
}

function set(next: TimerState) {
  state = next
  localStorage.setItem(KEY, JSON.stringify(next))
  schedule()
  listeners.forEach((l) => l())
}

function schedule() {
  clearTimeout(timeout)
  if (!state.endAt) return
  timeout = setTimeout(
    () => {
      set({ endAt: null, total: 0 })
      alertEnd()
    },
    Math.max(0, state.endAt - Date.now()),
  )
}
schedule()

let audioCtx: AudioContext | undefined
/** À appeler lors d'un geste utilisateur pour autoriser le son sur iOS. */
export function unlockAudio() {
  try {
    audioCtx ??= new AudioContext()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
  } catch {
    /* pas de son disponible */
  }
}

function beep() {
  if (!audioCtx) return
  const t = audioCtx.currentTime
  for (const [i, f] of [880, 880, 1320].entries()) {
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t + i * 0.25)
    g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.25 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.2)
    o.connect(g).connect(audioCtx.destination)
    o.start(t + i * 0.25)
    o.stop(t + i * 0.25 + 0.22)
  }
}

async function alertEnd() {
  navigator.vibrate?.([300, 120, 300, 120, 500])
  beep()
  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker?.getRegistration()
    const opts = { body: "C'est reparti pour la série suivante 💪", icon: 'pwa-192.png', tag: 'rest' }
    if (reg) await reg.showNotification('Repos terminé', opts)
    else new Notification('Repos terminé', opts)
  }
}

export const restTimer = {
  start(seconds: number) {
    if (seconds <= 0) return
    unlockAudio()
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
    set({ endAt: Date.now() + seconds * 1000, total: seconds })
  },
  add(seconds: number) {
    if (!state.endAt) return
    const endAt = state.endAt + seconds * 1000
    if (endAt <= Date.now()) return set({ endAt: null, total: 0 })
    set({ endAt, total: Math.max(1, state.total + seconds) })
  },
  stop() {
    set({ endAt: null, total: 0 })
  },
}

export function useRestTimer() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}
