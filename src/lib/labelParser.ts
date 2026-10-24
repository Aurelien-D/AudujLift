// Extraction des valeurs nutritionnelles depuis le texte OCR d'une étiquette (FR / EN).
import type { Nutrients } from './types'

export type ParsedLabel = Partial<Nutrients>

const NUM = '(\\d{1,4}(?:[.,]\\d{1,3})?)'

/** Normalise le texte OCR : minuscules, accents retirés, confusions courantes corrigées. */
function clean(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/(\d)\s*o(?=\s*g\b)/g, (_, d) => `${d}0`) // "1o g" -> "10 g"
      .replace(/(\d) ([.,]) ?(\d)/g, '$1$2$3')
      // « 1,2g » lu « 1,29 » : un « g » collé est souvent confondu avec un 9 en fin de ligne
      .replace(/(\d[.,]\d)9(?=[ \t]*$)/gm, '$1 g')
      .replace(/[|]/g, ' ')
  )
}

function toNum(s: string | undefined): number | undefined {
  if (!s) return undefined
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

/** Premier nombre trouvé après le libellé, sur la même ligne. */
function after(lines: string[], label: RegExp, exclude?: RegExp): number | undefined {
  for (const line of lines) {
    const m = line.match(label)
    if (!m || (exclude && exclude.test(line))) continue
    const rest = line.slice((m.index ?? 0) + m[0].length)
    const n = rest.match(new RegExp(NUM))
    if (n) return toNum(n[1])
  }
  return undefined
}

export function parseNutritionLabel(raw: string): ParsedLabel {
  const text = clean(raw)
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
  const out: ParsedLabel = {}

  // Énergie : on cherche explicitement la valeur en kcal
  const kcalMatch = text.match(new RegExp(`${NUM}\\s*kcal`)) ?? text.match(new RegExp(`kcal\\s*[:/]?\\s*${NUM}`))
  if (kcalMatch) out.kcal = toNum(kcalMatch[1])
  if (out.kcal == null) {
    const kj = text.match(new RegExp(`${NUM}\\s*kj`))
    if (kj) out.kcal = Math.round(toNum(kj[1])! / 4.184)
  }

  out.fat = after(lines, /(matieres? grasses|lipides|graisses|\bfat\b)/, /(saturés|satures|saturated|dont|of which)/)
  out.saturatedFat = after(lines, /(acides gras satures|satures|saturated)/)
  out.carbs = after(lines, /(glucides|carbohydrate|hydrates de carbone)/, /(dont|of which)\s*(sucres|sugars)/)
  out.sugar = after(lines, /(sucres|sugars)/)
  out.fiber = after(lines, /(fibres?( alimentaires)?|fibre)/)
  out.protein = after(lines, /(proteines|protein)/)
  out.salt = after(lines, /\b(sel|salt)\b/)

  for (const k of Object.keys(out) as (keyof ParsedLabel)[]) if (out[k] == null) delete out[k]
  return fixImplausible(out)
}

/**
 * Lectures possibles d'un nombre mal reconnu : « 1,2g » devient souvent « 129 » (virgule perdue, g lu 9).
 * On propose : sans le 9 final, puis avec une décimale.
 */
function candidates(v: number): number[] {
  const s = String(v)
  if (!/^\d+$/.test(s)) return []
  const out: number[] = []
  const t = s.endsWith('9') && s.length >= 2 ? s.slice(0, -1) : s
  if (t !== s) out.push(Number(t) / 10, Number(t))
  if (t === s && s.length >= 2) out.push(v / 10)
  return out
}

const G_KEYS = ['protein', 'carbs', 'fat', 'sugar', 'saturatedFat', 'fiber', 'salt'] as const
const PARENT: Partial<Record<(typeof G_KEYS)[number], 'carbs' | 'fat'>> = { sugar: 'carbs', saturatedFat: 'fat' }

/** Corrige les valeurs impossibles (> 100 g pour 100 g, sous-total > total, macros incohérentes avec les kcal). */
export function fixImplausible(v: ParsedLabel): ParsedLabel {
  const out = { ...v }
  const kcalError = (n: ParsedLabel) => (out.kcal ? Math.abs((n.protein ?? 0) * 4 + (n.carbs ?? 0) * 4 + (n.fat ?? 0) * 9 - out.kcal) : 0)
  // Totaux d'abord, puis sous-totaux (qui dépendent de leur parent)
  for (const k of ['protein', 'carbs', 'fat', 'fiber', 'salt', 'sugar', 'saturatedFat'] as const) {
    const val = out[k]
    if (val == null) continue
    const parent = PARENT[k]
    const max = parent && out[parent] != null ? out[parent]! : 100
    const ok = (x: number) => x <= max
    if (ok(val)) continue
    const valid = candidates(val).filter(ok)
    if (!valid.length) {
      delete out[k]
      continue
    }
    // Pour un macro principal, on garde la lecture la plus cohérente avec l'énergie
    out[k] = parent || !out.kcal ? valid[0] : valid.sort((a, b) => kcalError({ ...out, [k]: a }) - kcalError({ ...out, [k]: b }))[0]
  }
  return out
}
