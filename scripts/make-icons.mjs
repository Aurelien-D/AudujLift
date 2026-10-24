// Génère favicon.svg et les icônes PWA (PNG) à partir de l'emblème solaire.
// Usage : node scripts/make-icons.mjs  (nécessite Playwright/Chromium)
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180
  const long = i % 3 === 0
  const r1 = 17,
    r2 = long ? 30 : 25.5,
    w = long ? 2.6 : 2
  const p = (r, da) => [32 + r * Math.sin(a + da), 32 - r * Math.cos(a + da)]
  const [x1, y1] = p(r1, -w / r1),
    [x2, y2] = p(r1, w / r1),
    [x3, y3] = p(r2, 0)
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x3.toFixed(2)} ${y3.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}Z`
}).join('')
const FRACTURE = 'M45 4 L35.5 25 L40 29.5 L27 47 L30.5 50 L21 62'

const svg = (pad, radius = 0.22) => {
  const s = 64 + 2 * pad
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${s} ${s}"><defs><radialGradient id="g" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#1a1d25"/><stop offset="1" stop-color="#0B0D12"/></radialGradient><mask id="m"><rect x="${-pad}" y="${-pad}" width="${s}" height="${s}" fill="#fff"/><path d="${FRACTURE}" fill="none" stroke="#000" stroke-width="2.6"/></mask></defs><rect x="${-pad}" y="${-pad}" width="${s}" height="${s}" rx="${s * radius}" fill="url(#g)"/><g mask="url(#m)" fill="#D6B56E"><path d="${RAYS}"/><circle cx="32" cy="32" r="12.5"/><circle cx="32" cy="32" r="15" fill="none" stroke="#D6B56E" stroke-width="1.2" opacity="0.55"/></g></svg>`
}

writeFileSync('public/favicon.svg', svg(8))
const browser = await chromium.launch()
for (const [name, size, pad, radius] of [
  ['pwa-512.png', 512, 14, 0],
  ['pwa-192.png', 192, 14, 0],
  ['apple-touch-icon.png', 180, 14, 0],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<html><body style="margin:0;background:#0B0D12">${svg(pad, radius).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  await page.screenshot({ path: `public/${name}` })
  await page.close()
}
await browser.close()
console.log('icônes générées')
