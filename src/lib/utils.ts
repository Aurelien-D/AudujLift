export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

/** Date locale au format YYYY-MM-DD */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Lundi (00:00) de la semaine contenant la date */
export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - day)
  return r
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function formatDayLabel(iso: string): string {
  const today = toISODate()
  if (iso === today) return "Aujourd'hui"
  if (iso === addDays(today, -1)) return 'Hier'
  if (iso === addDays(today, 1)) return 'Demain'
  return capitalize(dayFmt.format(fromISODate(iso)))
}

export const formatDate = (ts: number) => capitalize(dayFmt.format(new Date(ts)))
export const formatShortDate = (ts: number | Date) => shortFmt.format(ts)
export const formatTime = (ts: number) => timeFmt.format(ts)

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** 3725 s -> "1:02:05" ; 125 -> "2:05" */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/** Durée lisible : "1 h 05" / "45 min" */
export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

export function round(n: number, decimals = 1): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

export function formatNumber(n: number, decimals = 1): string {
  return round(n, decimals).toLocaleString('fr-FR')
}

/** Parse un nombre saisi en français ("72,5") */
export function parseNum(v: string): number | undefined {
  if (v.trim() === '') return undefined
  const n = Number(v.replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : undefined
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
