// Analyse d'une photo d'assiette par Claude (vision) : aliments visibles + poids estimés.
// Les calories et macros sont ensuite calculées par l'appli à partir de la table Ciqual.
import type Anthropic from '@anthropic-ai/sdk'

export const PLATE_MODEL = 'claude-opus-5-5'
/** Tarif Claude Opus 5.5 (USD par million de tokens) — pour l'estimation affichée */
const PRICE_IN = 4
const PRICE_OUT = 20

const KEY = 'audujlift.anthropicKey'
const USAGE_KEY = 'audujlift.aiUsage'

// ---------- Clé d'API (sur l'appareil uniquement, hors sauvegardes) ----------

export function aiKey(): string | null {
  try {
    return localStorage.getItem(KEY) || null
  } catch {
    return null
  }
}
export const saveAiKey = (k: string) => localStorage.setItem(KEY, k.trim())
export const forgetAiKey = () => localStorage.removeItem(KEY)
/** « sk-ant-…a1b2 » */
export const maskKey = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : '…')

// ---------- Suivi de la dépense (estimation) ----------

export interface AiUsage {
  month: string
  photos: number
  costUsd: number
}

const thisMonth = () => new Date().toISOString().slice(0, 7)

export function aiUsage(): AiUsage {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) ?? 'null') as AiUsage | null
    if (u && u.month === thisMonth()) return u
  } catch {
    /* rien */
  }
  return { month: thisMonth(), photos: 0, costUsd: 0 }
}

/** Coût estimé d'une requête (tokens de réflexion inclus dans output_tokens). */
export function estimateCostUsd(usage: {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}): number {
  const input = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) * 1.25 + (usage.cache_read_input_tokens ?? 0) * 0.1
  return (input * PRICE_IN + usage.output_tokens * PRICE_OUT) / 1e6
}

function recordUsage(cost: number) {
  const u = aiUsage()
  localStorage.setItem(USAGE_KEY, JSON.stringify({ month: u.month, photos: u.photos + 1, costUsd: u.costUsd + cost }))
}

// ---------- Réponse structurée ----------

export interface PlateItem {
  /** Nom court affiché (« Riz blanc ») */
  name: string
  /** Nom générique façon table Ciqual, pour retrouver les valeurs officielles */
  query: string
  /** Poids estimé dans l'assiette (g, tel que servi) */
  grams: number
  confidence: 'high' | 'medium' | 'low'
  /** Estimation de l'IA pour 100 g, utilisée si aucun aliment Ciqual ne correspond */
  per100: { kcal: number; protein: number; carbs: number; fat: number }
}

export interface PlateAnalysis {
  items: PlateItem[]
  note: string
}

const NUM = { type: 'number' } as const

export const PLATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'note'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'query', 'grams', 'confidence', 'kcal_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g'],
        properties: {
          name: { type: 'string' },
          query: { type: 'string' },
          grams: NUM,
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          kcal_per_100g: NUM,
          protein_per_100g: NUM,
          carbs_per_100g: NUM,
          fat_per_100g: NUM,
        },
      },
    },
    note: { type: 'string' },
  },
}

const SYSTEM = `Tu es diététicien. On te montre la photo d'un repas prise par l'utilisateur d'une appli de suivi nutritionnel française.

Identifie chaque aliment distinct visible dans l'assiette ou le bol, et estime le poids réellement présent en grammes, cuit et tel que servi. Appuie-toi sur les repères d'échelle (assiette plate d'environ 26 cm, bol, couverts, main, emballage). Ajoute les matières grasses ou sauces probables (huile, beurre, vinaigrette, mayonnaise) comme éléments séparés quand elles sont visibles ou très vraisemblables, avec une confiance « low » si tu les déduis.

Pour chaque aliment :
- name : nom court en français (« Riz blanc », « Blanc de poulet »).
- query : nom générique tel qu'il figure dans la table Ciqual de l'ANSES, sans marque (« Riz blanc, cuit », « Poulet, filet, sans peau, cuit », « Haricot vert, cuit », « Huile d'olive vierge extra »).
- grams : poids estimé.
- confidence : high, medium ou low selon ta certitude sur l'aliment et la portion.
- kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g : valeurs typiques pour 100 g de cet aliment tel que servi.

note : une phrase courte en français qui signale ce qui est incertain (sauce cachée, portion difficile à juger…). Si l'image ne montre pas de nourriture ou est inexploitable, renvoie une liste vide et explique pourquoi dans note.`

/** Valide et borne la réponse JSON du modèle. */
export function parsePlateResponse(text: string): PlateAnalysis {
  const raw = JSON.parse(text) as {
    items?: {
      name?: string
      query?: string
      grams?: number
      confidence?: string
      kcal_per_100g?: number
      protein_per_100g?: number
      carbs_per_100g?: number
      fat_per_100g?: number
    }[]
    note?: string
  }
  const clamp = (n: unknown, max: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0)
  const items: PlateItem[] = (raw.items ?? [])
    .filter((i) => i.name?.trim() && clamp(i.grams, 3000) > 0)
    .map((i) => ({
      name: i.name!.trim(),
      query: (i.query || i.name)!.trim(),
      grams: Math.round(clamp(i.grams, 3000)),
      confidence: i.confidence === 'high' || i.confidence === 'low' ? i.confidence : 'medium',
      per100: { kcal: clamp(i.kcal_per_100g, 950), protein: clamp(i.protein_per_100g, 100), carbs: clamp(i.carbs_per_100g, 100), fat: clamp(i.fat_per_100g, 100) },
    }))
  return { items, note: raw.note?.trim() ?? '' }
}

/** Envoie la photo (data URL JPEG) à Claude et renvoie les aliments reconnus. */
export async function analyzePlate(dataUrl: string, apiKey: string, signal?: AbortSignal): Promise<PlateAnalysis> {
  const { default: AnthropicSDK } = await import('@anthropic-ai/sdk')
  // Appel direct depuis le navigateur : la clé appartient à l'utilisateur et reste sur son appareil
  const client = new AnthropicSDK({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
  const [head, data] = dataUrl.split(',')
  const media_type = /image\/(png|webp|gif)/.exec(head)?.[0] ?? 'image/jpeg'

  let res: Anthropic.Beta.BetaMessage
  try {
    res = await client.beta.messages.create(
      {
        model: PLATE_MODEL,
        max_tokens: 16000,
        // En cas de refus par un filtre de sécurité, l'API relance la requête sur le modèle de secours conseillé
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLATE_SCHEMA } },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: media_type as 'image/jpeg', data } },
              { type: 'text', text: 'Analyse ce repas.' },
            ],
          },
        ],
      },
      { signal },
    )
  } catch (e) {
    if (signal?.aborted) throw e
    if (e instanceof AnthropicSDK.AuthenticationError) throw new Error('Clé d’API refusée : vérifie-la dans Profil.')
    if (e instanceof AnthropicSDK.PermissionDeniedError) throw new Error('Cette clé n’a pas accès au modèle. Vérifie ton compte sur console.anthropic.com.')
    if (e instanceof AnthropicSDK.RateLimitError) throw new Error('Trop de demandes d’un coup : réessaie dans une minute.')
    if (e instanceof AnthropicSDK.BadRequestError) throw new Error(`Demande refusée par l’API (crédit épuisé ?) : ${e.message}`)
    if (e instanceof AnthropicSDK.APIConnectionError) throw new Error('Pas de connexion : l’analyse de photo nécessite Internet.')
    if (e instanceof AnthropicSDK.APIError) throw new Error(`Service d’IA indisponible (${e.status ?? 'erreur'}). Réessaie plus tard.`)
    throw e
  }

  recordUsage(estimateCostUsd(res.usage))
  if (res.stop_reason === 'refusal') throw new Error('L’IA n’a pas pu analyser cette photo. Essaie avec une autre photo.')
  if (res.stop_reason === 'max_tokens') throw new Error('Réponse incomplète : réessaie.')
  const text = res.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('Réponse vide : réessaie.')
  return parsePlateResponse(text.text)
}

/**
 * Choisit l'aliment Ciqual le plus cohérent avec l'estimation de l'IA parmi les candidats de la recherche
 * (évite par exemple « jambon de poulet » pour un filet de poulet rôti). Renvoie -1 si aucun ne colle :
 * l'estimation de l'IA est alors utilisée.
 */
export function pickCandidate(candidates: { per100: { kcal: number; protein: number; carbs: number; fat: number } }[], ai: PlateItem['per100']): number {
  let best = -1
  let bestScore = Infinity
  candidates.forEach((c, rank) => {
    const kcalGap = Math.abs(c.per100.kcal - ai.kcal)
    if (kcalGap > Math.max(40, ai.kcal * 0.35)) return
    const macroGap = Math.abs(c.per100.protein - ai.protein) + Math.abs(c.per100.carbs - ai.carbs) + Math.abs(c.per100.fat - ai.fat)
    const score = kcalGap / Math.max(ai.kcal, 50) + (0.5 * macroGap) / Math.max(ai.protein + ai.carbs + ai.fat, 10) + rank * 0.05
    if (score < bestScore) {
      bestScore = score
      best = rank
    }
  })
  return best
}
