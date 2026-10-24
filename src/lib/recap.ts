import { sigilSvg } from './sigil'
import type { PRHit, WorkoutTotals } from './stats'
import { formatDate, formatDuration, formatNumber } from './utils'

export interface RecapData {
  name: string
  startedAt: number
  totals: WorkoutTotals
  /** Une ligne par exercice : nom et meilleure série */
  exercises: { name: string; best: string }[]
  records: (PRHit & { exercise: string })[]
}

const C = { ink: '#0B0D12', surface: '#161920', line: '#2D313A', ivory: '#EEEAE2', silver: '#9398A5', gold: '#D6B56E', amethyst: '#A58AD0' }
const DISPLAY = '"Space Grotesk Variable", "Inter Variable", system-ui, sans-serif'
const TEXT = '"Inter Variable", system-ui, sans-serif'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Coupe un texte trop long avec « … » pour tenir dans `max` pixels. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/** Image récapitulative de la séance (1080 × 1350, format portrait des réseaux sociaux). */
export async function renderRecap(d: RecapData): Promise<Blob> {
  const W = 1080
  const H = 1350
  const P = 88
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  await Promise.allSettled([document.fonts?.load(`600 64px ${DISPLAY}`), document.fonts?.load(`400 32px ${TEXT}`)])

  // Fond : obsidienne avec un halo solaire très discret
  ctx.fillStyle = C.ink
  ctx.fillRect(0, 0, W, H)
  const halo = ctx.createRadialGradient(W - 140, 140, 0, W - 140, 140, 700)
  halo.addColorStop(0, 'rgba(214,181,110,0.10)')
  halo.addColorStop(1, 'rgba(214,181,110,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, W, H)

  const sigil = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sigilSvg(C.gold, 256))}`).catch(() => null)
  if (sigil) {
    ctx.globalAlpha = 0.07
    ctx.drawImage(sigil, W - 420, -60, 520, 520)
    ctx.globalAlpha = 1
    ctx.drawImage(sigil, P, P - 6, 56, 56)
  }
  ctx.fillStyle = C.gold
  ctx.font = `600 28px ${DISPLAY}`
  ctx.letterSpacing = '6px'
  ctx.fillText('AUDUJLIFT', P + 76, P + 32)
  ctx.letterSpacing = '0px'

  let y = P + 150
  ctx.fillStyle = C.silver
  ctx.font = `400 30px ${TEXT}`
  ctx.fillText(formatDate(d.startedAt), P, y)
  y += 78
  ctx.fillStyle = C.ivory
  ctx.font = `600 72px ${DISPLAY}`
  ctx.fillText(fit(ctx, d.name, W - 2 * P), P, y)

  // Chiffres clés
  y += 70
  const stats = [
    ['Durée', formatDuration(d.totals.durationMs)],
    ['Volume', `${formatNumber(d.totals.volume, 0)} kg`],
    ['Séries', String(d.totals.sets)],
  ]
  const colW = (W - 2 * P) / 3
  ctx.strokeStyle = C.line
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(P, y)
  ctx.lineTo(W - P, y)
  ctx.stroke()
  stats.forEach(([label, value], i) => {
    const x = P + i * colW
    ctx.fillStyle = C.silver
    ctx.font = `600 22px ${TEXT}`
    ctx.letterSpacing = '3px'
    ctx.fillText(label.toUpperCase(), x, y + 56)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = C.ivory
    ctx.font = `600 52px ${DISPLAY}`
    ctx.fillText(fit(ctx, value, colW - 16), x, y + 120)
  })
  y += 160
  ctx.beginPath()
  ctx.moveTo(P, y)
  ctx.lineTo(W - P, y)
  ctx.stroke()

  // Exercices
  y += 70
  const maxLines = d.records.length ? 5 : 8
  for (const e of d.exercises.slice(0, maxLines)) {
    ctx.fillStyle = C.gold
    ctx.font = `500 32px ${DISPLAY}`
    const right = e.best
    const rw = ctx.measureText(right).width
    ctx.fillText(right, W - P - rw, y)
    ctx.fillStyle = C.ivory
    ctx.font = `400 32px ${TEXT}`
    ctx.fillText(fit(ctx, e.name, W - 2 * P - rw - 32), P, y)
    y += 58
  }
  if (d.exercises.length > maxLines) {
    ctx.fillStyle = C.silver
    ctx.font = `400 26px ${TEXT}`
    ctx.fillText(`+ ${d.exercises.length - maxLines} autre${d.exercises.length - maxLines > 1 ? 's' : ''} exercice${d.exercises.length - maxLines > 1 ? 's' : ''}`, P, y)
    y += 50
  }

  // Records : l'améthyste est réservée à l'exceptionnel
  if (d.records.length) {
    y += 30
    ctx.fillStyle = C.amethyst
    ctx.font = `600 22px ${TEXT}`
    ctx.letterSpacing = '3px'
    ctx.fillText(`${d.records.length} RECORD${d.records.length > 1 ? 'S' : ''} PERSONNEL${d.records.length > 1 ? 'S' : ''}`, P, y)
    ctx.letterSpacing = '0px'
    y += 56
    for (const r of d.records.slice(0, 3)) {
      ctx.fillStyle = C.ivory
      ctx.font = `400 30px ${TEXT}`
      const value = r.previous ? `${r.previous} → ${r.value}` : r.value
      ctx.font = `600 30px ${DISPLAY}`
      const vw = ctx.measureText(value).width
      ctx.fillStyle = C.gold
      ctx.fillText(value, W - P - vw, y)
      ctx.fillStyle = C.ivory
      ctx.font = `400 30px ${TEXT}`
      ctx.fillText(fit(ctx, `${r.exercise} · ${r.label}`, W - 2 * P - vw - 32), P, y)
      y += 52
    }
  }

  // Signature
  ctx.fillStyle = C.gold
  ctx.fillRect(P, H - P - 2, 64, 2)
  ctx.fillStyle = C.silver
  ctx.font = `400 24px ${TEXT}`
  ctx.fillText('Dark Solar Performance', P + 84, H - P + 6)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image impossible à créer'))), 'image/png'))
}

/** Partage l'image (feuille de partage iOS/Android) ou la télécharge à défaut. */
export async function shareRecap(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
