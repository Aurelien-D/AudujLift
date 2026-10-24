// Contribution à Open Food Facts : ajoute un produit créé dans l'appli à la base collaborative.
// L'écriture exige un compte Open Food Facts (gratuit) ; les identifiants restent sur l'appareil.
import { fetchProductByBarcode } from './off'
import type { Food } from './types'

const OFF = 'https://world.openfoodfacts.org'
const KEY = 'audujlift.offAccount'

export interface OffAccount {
  userId: string
  password: string
}

/** Compte mémorisé sur cet appareil (hors des sauvegardes, partagé entre profils). */
export function offAccount(): OffAccount | null {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? 'null') as OffAccount | null
    return a?.userId && a.password ? a : null
  } catch {
    return null
  }
}

export function saveOffAccount(a: OffAccount) {
  localStorage.setItem(KEY, JSON.stringify(a))
}

export function forgetOffAccount() {
  localStorage.removeItem(KEY)
}

/** Un code EAN/UPC plausible (8 à 14 chiffres). */
export const isValidBarcode = (code?: string) => !!code && /^\d{8,14}$/.test(code)

const num = (v: number | undefined) => (v == null ? undefined : String(Math.round(v * 1000) / 1000))

/** Champs du formulaire d'ajout Open Food Facts (valeurs pour 100 g / 100 ml). */
export function offFields(food: Food): Record<string, string> {
  const n = food.per100
  const fields: Record<string, string | undefined> = {
    code: food.barcode,
    lang: 'fr',
    product_name_fr: food.name.trim(),
    brands: food.brand?.trim() || undefined,
    countries: 'France',
    serving_size: food.servingSize ? `${num(food.servingSize)} ${food.unit}` : undefined,
    nutrition_data_per: '100g',
    'nutriment_energy-kcal': num(n.kcal),
    'nutriment_energy-kcal_unit': 'kcal',
    nutriment_proteins: num(n.protein),
    nutriment_carbohydrates: num(n.carbs),
    nutriment_fat: num(n.fat),
    nutriment_sugars: num(n.sugar),
    nutriment_fiber: num(n.fiber),
    'nutriment_saturated-fat': num(n.saturatedFat),
    nutriment_salt: num(n.salt),
    comment: 'Ajouté depuis AudujLift',
  }
  for (const k of ['proteins', 'carbohydrates', 'fat', 'sugars', 'fiber', 'saturated-fat', 'salt']) if (fields[`nutriment_${k}`] != null) fields[`nutriment_${k}_unit`] = 'g'
  return Object.fromEntries(Object.entries(fields).filter((e): e is [string, string] => e[1] != null && e[1] !== ''))
}

async function post(path: string, form: FormData): Promise<{ status?: number; status_verbose?: string }> {
  let res: Response
  try {
    res = await fetch(`${OFF}${path}`, { method: 'POST', body: form })
  } catch {
    throw new Error('Open Food Facts ne répond pas. Réessaie dans un moment.')
  }
  if (res.status === 403 || res.status === 401) throw new Error('Identifiant ou mot de passe Open Food Facts incorrect.')
  if (!res.ok) throw new Error(`Open Food Facts indisponible (${res.status}). Réessaie plus tard.`)
  return res.json().catch(() => ({}))
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export type ContributeResult = { status: 'sent'; photos: number; photoErrors: number } | { status: 'exists' }

/**
 * Envoie le produit (puis ses photos : face et tableau nutritionnel).
 * Ne modifie jamais un produit existant : s'il est déjà dans la base, on s'arrête.
 */
export async function contributeToOff(food: Food, account: OffAccount): Promise<ContributeResult> {
  if (!isValidBarcode(food.barcode)) throw new Error('Il faut un code-barres valide (8 à 14 chiffres).')
  if (await fetchProductByBarcode(food.barcode!)) return { status: 'exists' }

  const form = new FormData()
  form.append('user_id', account.userId)
  form.append('password', account.password)
  for (const [k, v] of Object.entries(offFields(food))) form.append(k, v)
  const res = await post('/cgi/product_jqm2.pl', form)
  if (res.status !== 1) throw new Error(res.status_verbose ? `Refusé par Open Food Facts : ${res.status_verbose}` : 'Envoi refusé par Open Food Facts.')

  // photos[0] = face du paquet, photos[1] = tableau nutritionnel
  let sent = 0
  let errors = 0
  for (const [i, field] of [
    [0, 'front_fr'],
    [1, 'nutrition_fr'],
  ] as const) {
    const img = food.photos?.[i]
    if (!img) continue
    const f = new FormData()
    f.append('user_id', account.userId)
    f.append('password', account.password)
    f.append('code', food.barcode!)
    f.append('imagefield', field)
    f.append(`imgupload_${field}`, dataUrlToBlob(img), `${field}.jpg`)
    try {
      await post('/cgi/product_image_upload.pl', f)
      sent++
    } catch {
      errors++
    }
  }
  return { status: 'sent', photos: sent, photoErrors: errors }
}

export const offProductUrl = (code: string) => `${OFF}/product/${code}`
