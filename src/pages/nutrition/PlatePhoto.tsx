import { Camera, ExternalLink, ImagePlus, KeyRound, Minus, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SolarSigil } from '../../components/SolarSigil'
import { Button, Card, Chip, Field, inputClass, MacroLine, Page } from '../../components/ui'
import { searchCiqual } from '../../lib/ciqual'
import { db } from '../../lib/db'
import { ensureFood, logFood } from '../../lib/foods'
import { compressImage } from '../../lib/image'
import { MEAL_LABELS, MEALS, scaleNutrients, sumNutrients } from '../../lib/nutrition'
import { aiKey, analyzePlate, pickCandidate, saveAiKey, type PlateItem } from '../../lib/plate-ai'
import type { Food, Meal } from '../../lib/types'
import { cn, toISODate, uid } from '../../lib/utils'
import { defaultMeal } from './AddFood'

/** Saisie de la clé d'API Anthropic (réutilisée dans le profil). */
export function AiKeySetup({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState('')
  const valid = /^sk-ant-[\w-]{20,}$/.test(key.trim())
  return (
    <div className="space-y-3 text-sm">
      <p className="text-silver">
        L'analyse de photo utilise Claude Opus 5.5 (Anthropic). Il te faut une clé d'API : compte gratuit, crédit prépayé à partir de quelques euros, environ 2 à 3 centimes par
        photo.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-silver">
        <li>
          Crée un compte sur{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-gold underline">
            console.anthropic.com
          </a>
        </li>
        <li>Ajoute du crédit dans Billing (5 à 10 $ suffisent pour des centaines de photos).</li>
        <li>Crée une clé dans API Keys et colle-la ci-dessous.</li>
      </ol>
      <Field label="Clé d'API (commence par sk-ant-)">
        <input value={key} onChange={(e) => setKey(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="sk-ant-…" className={inputClass} />
      </Field>
      <p className="text-xs text-silver-dim">La clé reste uniquement sur ce téléphone (jamais dans les sauvegardes). Tu peux l'effacer à tout moment depuis Profil.</p>
      <Button
        variant="primary"
        className="w-full"
        disabled={!valid}
        onClick={() => {
          saveAiKey(key)
          onSaved()
        }}
      >
        <KeyRound size={18} /> Enregistrer la clé
      </Button>
    </div>
  )
}

interface Row {
  id: string
  item: PlateItem
  grams: number
  /** Aliments Ciqual candidats ; index choisi, ou -1 pour l'estimation de l'IA */
  candidates: Food[]
  choice: number
  removed?: boolean
}

const nutrientsOf = (r: Row) => scaleNutrients(r.choice >= 0 ? r.candidates[r.choice].per100 : r.item.per100, r.grams)

export default function PlatePhoto() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const date = params.get('date') ?? toISODate()
  const [meal, setMeal] = useState<Meal>((params.get('meal') as Meal) || defaultMeal())
  const [hasKey, setHasKey] = useState(() => !!aiKey())
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [note, setNote] = useState('')
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => () => ctrl.current?.abort(), [])

  const analyze = async (file: File) => {
    setError(null)
    setRows(null)
    setBusy(true)
    ctrl.current = new AbortController()
    try {
      const img = await compressImage(file, 1092, 0.82)
      setPhoto(img)
      const res = await analyzePlate(img, aiKey()!, ctrl.current.signal)
      setNote(res.note)
      // Valeurs officielles : on cherche chaque aliment dans la table Ciqual
      const next = await Promise.all(
        res.items.map(async (item): Promise<Row> => {
          let candidates = await searchCiqual(item.query, 5)
          if (!candidates.length) candidates = await searchCiqual(item.name, 5)
          return { id: uid(), item, grams: item.grams, candidates, choice: pickCandidate(candidates, item.per100) }
        }),
      )
      setRows(next)
    } catch (e) {
      if (!ctrl.current?.signal.aborted) setError((e as Error).message || 'Analyse impossible.')
    } finally {
      setBusy(false)
    }
  }

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null)
  const kept = (rows ?? []).filter((r) => !r.removed && r.grams > 0)
  const total = sumNutrients(kept.map(nutrientsOf))

  const save = async () => {
    for (const r of kept) {
      if (r.choice >= 0) {
        const food = await ensureFood(r.candidates[r.choice])
        await logFood(food, r.grams, date, meal)
      } else {
        await db.entries.add({
          id: uid(),
          date,
          meal,
          name: `${r.item.name} (estimé)`,
          quantity: r.grams,
          unit: 'g',
          nutrients: nutrientsOf(r),
          createdAt: Date.now(),
        })
      }
    }
    navigate(`/nutrition${date === toISODate() ? '' : `?date=${date}`}`, { replace: true })
  }

  const pickers = (
    <>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void analyze(f)
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void analyze(f)
        }}
      />
    </>
  )

  if (!hasKey)
    return (
      <Page back title="Photo de l'assiette">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={20} className="text-gold" />
            <h2 className="font-semibold">Activer l'analyse par IA</h2>
          </div>
          <AiKeySetup onSaved={() => setHasKey(true)} />
        </Card>
      </Page>
    )

  return (
    <Page back title="Photo de l'assiette" subtitle={MEAL_LABELS[meal]}>
      {pickers}
      <div className="no-scrollbar -mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 pb-3">
        {MEALS.map((m) => (
          <Chip key={m} active={m === meal} onClick={() => setMeal(m)}>
            {MEAL_LABELS[m]}
          </Chip>
        ))}
      </div>

      {photo && (
        <div className="relative overflow-hidden rounded-[18px] border border-line/70">
          <img src={photo} alt="Ton assiette" className={cn('max-h-72 w-full object-cover transition', busy && 'opacity-50 blur-[1px]')} />
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/40">
              <SolarSigil size={44} className="animate-spin text-gold [animation-duration:2.4s]" />
              <span className="rounded-full bg-ink/80 px-3 py-1.5 text-sm text-ivory">Analyse de l'assiette… 10 à 30 s</span>
            </div>
          )}
        </div>
      )}

      {!photo && !busy && (
        <Card glow className="flex flex-col items-center gap-4 py-8 text-center">
          <SolarSigil size={40} className="text-gold/80" />
          <div>
            <h2 className="text-lg font-semibold">Prends ton assiette en photo</h2>
            <p className="mt-1 text-sm text-silver">Vue de dessus, bien éclairée, avec les couverts ou la main pour l'échelle. Tu pourras ajuster les quantités avant d'ajouter.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="primary" size="lg" onClick={() => camera.current?.click()}>
              <Camera size={20} /> Photo
            </Button>
            <Button variant="secondary" size="lg" onClick={() => gallery.current?.click()}>
              <ImagePlus size={20} /> Galerie
            </Button>
          </div>
        </Card>
      )}

      {busy && (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => ctrl.current?.abort()}>
          Annuler
        </Button>
      )}

      {error && (
        <Card className="mt-3 border-danger/40">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => camera.current?.click()}>
            <Camera size={16} /> Reprendre une photo
          </Button>
        </Card>
      )}

      {rows && !busy && (
        <>
          {rows.length === 0 ? (
            <Card className="mt-3">
              <p className="text-sm text-silver">{note || 'Aucun aliment reconnu sur cette photo.'}</p>
            </Card>
          ) : (
            <>
              <Card glow className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="label text-gold">Total estimé</span>
                  <span className="font-display text-3xl font-semibold">
                    {Math.round(total.kcal)} <span className="text-base font-normal text-silver">kcal</span>
                  </span>
                </div>
                <div className="mt-1 text-right">
                  <MacroLine kcal={total.kcal} protein={total.protein} carbs={total.carbs} fat={total.fat} />
                </div>
                {note && <p className="mt-2 text-xs text-silver">{note}</p>}
              </Card>

              <div className="mt-3 space-y-2">
                {rows.map((r) =>
                  r.removed ? null : (
                    <Card key={r.id} className="p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{r.item.name}</span>
                            {r.item.confidence !== 'high' && (
                              <span
                                className={cn(
                                  'shrink-0 rounded-full border px-1.5 text-[10px]',
                                  r.item.confidence === 'low' ? 'border-warn/50 text-warn' : 'border-line text-silver',
                                )}
                              >
                                {r.item.confidence === 'low' ? 'incertain' : 'à vérifier'}
                              </span>
                            )}
                          </div>
                          <select
                            aria-label={`Valeurs nutritionnelles de ${r.item.name}`}
                            value={r.choice}
                            onChange={(e) => update(r.id, { choice: Number(e.target.value) })}
                            className="mt-1 w-full truncate rounded-lg border border-line/70 bg-ink px-2 py-1 text-xs text-silver"
                          >
                            {r.candidates.map((c, i) => (
                              <option key={c.id} value={i}>
                                Ciqual : {c.name}
                              </option>
                            ))}
                            <option value={-1}>Estimation de l'IA</option>
                          </select>
                        </div>
                        <span className="w-14 shrink-0 text-right">
                          <span className="font-display font-semibold">{Math.round(nutrientsOf(r).kcal)}</span>
                          <span className="block text-[10px] text-silver">kcal</span>
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          aria-label="Moins 10 g"
                          onClick={() => update(r.id, { grams: Math.max(0, r.grams - 10) })}
                          className="press flex size-9 items-center justify-center rounded-lg bg-raised"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          aria-label={`Grammes de ${r.item.name}`}
                          inputMode="numeric"
                          value={r.grams || ''}
                          onChange={(e) => update(r.id, { grams: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                          className="h-9 w-20 rounded-lg border border-line bg-ink text-center font-semibold text-ivory"
                        />
                        <span className="text-sm text-silver">g</span>
                        <button
                          aria-label="Plus 10 g"
                          onClick={() => update(r.id, { grams: r.grams + 10 })}
                          className="press flex size-9 items-center justify-center rounded-lg bg-raised"
                        >
                          <Plus size={15} />
                        </button>
                        <button
                          aria-label={`Retirer ${r.item.name}`}
                          onClick={() => update(r.id, { removed: true })}
                          className="press ml-auto flex size-9 items-center justify-center rounded-lg text-silver"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </Card>
                  ),
                )}
              </div>

              <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!kept.length} onClick={save}>
                Ajouter au {MEAL_LABELS[meal].toLowerCase()} · {Math.round(total.kcal)} kcal
              </Button>
            </>
          )}
          <Button variant="tertiary" className="mt-2 w-full" onClick={() => camera.current?.click()}>
            <Camera size={18} /> Reprendre une photo
          </Button>
          <p className="mt-3 text-center text-xs text-silver-dim">
            Estimation par IA (marge d'environ 20 à 30 %) : huiles et sauces cachées sont difficiles à voir.{' '}
            <a href="https://console.anthropic.com/settings/usage" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-silver underline">
              Consommation <ExternalLink size={10} />
            </a>
          </p>
        </>
      )}
    </Page>
  )
}
