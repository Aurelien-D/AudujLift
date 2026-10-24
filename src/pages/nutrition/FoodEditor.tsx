import { Camera, Loader2, ScanText, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Field, inputClass, NumberInput, Page, Tabs } from '../../components/ui'
import { db } from '../../lib/db'
import { compressImage } from '../../lib/image'
import { kcalFromMacros } from '../../lib/nutrition'
import { readNutritionLabel } from '../../lib/ocr'
import type { Food, Nutrients } from '../../lib/types'
import { cn, uid } from '../../lib/utils'

const FIELDS: { key: keyof Nutrients; label: string; indent?: boolean }[] = [
  { key: 'kcal', label: 'Énergie (kcal)' },
  { key: 'protein', label: 'Protéines' },
  { key: 'carbs', label: 'Glucides' },
  { key: 'sugar', label: 'dont sucres', indent: true },
  { key: 'fat', label: 'Lipides' },
  { key: 'saturatedFat', label: 'dont saturés', indent: true },
  { key: 'fiber', label: 'Fibres' },
  { key: 'salt', label: 'Sel' },
]

function PhotoSlot({ label, value, onChange, hint }: { label: string; value?: string; onChange: (v?: string) => void; hint: string }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-zinc-400">{label}</div>
      <div
        onClick={() => !value && input.current?.click()}
        className={cn(
          'relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-dashed',
          value ? 'border-transparent' : 'border-zinc-700 bg-zinc-900 active:bg-zinc-800',
        )}
      >
        {value ? (
          <>
            <img src={value} alt={label} className="size-full object-cover" />
            <button onClick={() => onChange(undefined)} aria-label="Retirer la photo" className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5">
              <X size={16} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center text-xs text-zinc-400">
            <Camera size={26} className="text-lime-400" />
            {hint}
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) onChange(await compressImage(f))
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

export default function FoodEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [food, setFood] = useState<Food | null>(null)
  const [per, setPer] = useState<'100' | 'serving'>('100')
  const [ocr, setOcr] = useState<{ progress: number } | null>(null)
  const [ocrMsg, setOcrMsg] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const [filled, setFilled] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (id) db.foods.get(id).then((f) => setFood(f ?? null))
    else
      setFood({
        id: uid(),
        source: 'custom',
        barcode: params.get('barcode') ?? undefined,
        name: '',
        per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        unit: 'g',
        photos: [],
        createdAt: Date.now(),
      })
  }, [id, params])

  if (!food)
    return (
      <Page back title="Aliment">
        {null}
      </Page>
    )

  const set = (patch: Partial<Food>) => setFood({ ...food, ...patch })
  const photos = food.photos ?? []
  // photos[0] = paquet, photos[1] = étiquette ('' si absente)
  const setPhoto = (i: number, v?: string) => {
    const next = [photos[0] ?? '', photos[1] ?? '']
    next[i] = v ?? ''
    set({ photos: next })
  }

  // Les valeurs sont stockées pour 100 g ; en mode « par portion » on convertit à l'affichage
  const factor = per === 'serving' && food.servingSize ? food.servingSize / 100 : 1
  const getVal = (k: keyof Nutrients) => {
    const v = food.per100[k]
    return v == null || (v === 0 && !filled.has(k) && !id) ? undefined : Math.round(v * factor * 100) / 100
  }
  const setVal = (k: keyof Nutrients, v: number | undefined) => {
    const per100 = { ...food.per100 }
    if (v == null) {
      if (k === 'kcal' || k === 'protein' || k === 'carbs' || k === 'fat') per100[k] = 0
      else delete per100[k]
    } else per100[k] = v / factor
    setFilled(new Set(filled).add(k))
    set({ per100 })
  }

  const runOcr = async () => {
    const img = photos[1] || photos[0]
    if (!img) return
    setOcr({ progress: 0 })
    setOcrMsg(null)
    try {
      const { values, text } = await readNutritionLabel(img, (p) => setOcr({ progress: p }))
      setOcrText(text.trim() || null)
      const keys = Object.keys(values) as (keyof Nutrients)[]
      if (!keys.length) {
        setOcrMsg('Aucune valeur reconnue. Reprends la photo bien à plat, nette et sans reflet, ou saisis les valeurs à la main.')
      } else {
        setPer('100')
        set({ per100: { ...food.per100, ...values } })
        setFilled(new Set([...filled, ...keys]))
        setOcrMsg(`${keys.length} valeur${keys.length > 1 ? 's' : ''} lue${keys.length > 1 ? 's' : ''} sur l'étiquette (pour 100 g). Vérifie-les avant d'enregistrer.`)
      }
    } catch (e) {
      setOcrMsg(`Lecture impossible : ${(e as Error).message}`)
    } finally {
      setOcr(null)
    }
  }

  const computedKcal = Math.round(kcalFromMacros(food.per100))
  const valid = food.name.trim() && (food.per100.kcal > 0 || computedKcal > 0)

  const save = async () => {
    const per100 = { ...food.per100, kcal: food.per100.kcal || computedKcal }
    const saved: Food = { ...food, name: food.name.trim(), brand: food.brand?.trim() || undefined, per100, photos: photos.some(Boolean) ? photos : undefined }
    await db.foods.put(saved)
    const date = params.get('date')
    const meal = params.get('meal')
    if (!id && date && meal) navigate(`/nutrition/food/${saved.id}?date=${date}&meal=${meal}`, { replace: true })
    else navigate(-1)
  }

  const remove = async () => {
    if (!confirm('Supprimer cet aliment ? Les entrées déjà dans ton journal sont conservées.')) return
    await db.foods.delete(food.id)
    navigate('/nutrition', { replace: true })
  }

  return (
    <Page
      back
      title={id ? "Modifier l'aliment" : 'Nouvel aliment'}
      actions={
        <Button variant="primary" size="sm" disabled={!valid} onClick={save}>
          Enregistrer
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <PhotoSlot label="Paquet" hint="Photo de face" value={photos[0] || undefined} onChange={(v) => setPhoto(0, v)} />
        <PhotoSlot label="Étiquette" hint="Tableau des valeurs nutritionnelles" value={photos[1] || undefined} onChange={(v) => setPhoto(1, v)} />
      </div>
      {(photos[1] || photos[0]) && (
        <Button variant="secondary" className="mt-3 w-full" onClick={runOcr} disabled={!!ocr}>
          {ocr ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Lecture de l'étiquette… {Math.round(ocr.progress * 100)} %
            </>
          ) : (
            <>
              <ScanText size={18} className="text-lime-400" /> Lire les valeurs sur la photo
            </>
          )}
        </Button>
      )}
      {ocrMsg && <p className="mt-2 text-sm text-zinc-300">{ocrMsg}</p>}
      {ocrText && (
        <details className="mt-2 text-xs text-zinc-400">
          <summary className="cursor-pointer">Texte reconnu</summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-zinc-950 p-2 whitespace-pre-wrap">{ocrText}</pre>
        </details>
      )}

      <Card className="mt-4 space-y-3">
        <Field label="Nom *">
          <input value={food.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex. Skyr nature 0 %" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marque">
            <input value={food.brand ?? ''} onChange={(e) => set({ brand: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Code-barres">
            <input inputMode="numeric" value={food.barcode ?? ''} onChange={(e) => set({ barcode: e.target.value.replace(/\D/g, '') || undefined })} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unité">
            <Tabs
              value={food.unit}
              onChange={(u) => set({ unit: u })}
              tabs={[
                { value: 'g', label: 'g' },
                { value: 'ml', label: 'ml' },
              ]}
            />
          </Field>
          <Field label={`Portion (${food.unit})`}>
            <NumberInput value={food.servingSize} onChange={(v) => set({ servingSize: v || undefined })} placeholder="Ex. 150" />
          </Field>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-bold">Valeurs nutritionnelles</h3>
          {food.servingSize ? (
            <div className="w-44">
              <Tabs
                value={per}
                onChange={setPer}
                tabs={[
                  { value: '100', label: `/100 ${food.unit}` },
                  { value: 'serving', label: '/portion' },
                ]}
              />
            </div>
          ) : (
            <span className="text-xs text-zinc-400">pour 100 {food.unit}</span>
          )}
        </div>
        <div className="space-y-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className={cn('flex-1 text-sm', f.indent ? 'pl-4 text-zinc-400' : 'font-medium')}>{f.label}</span>
              <div className="w-28 shrink-0">
                <NumberInput
                  value={getVal(f.key)}
                  onChange={(v) => setVal(f.key, v)}
                  placeholder={f.key === 'kcal' && computedKcal ? String(computedKcal) : '0'}
                  className={cn('py-2 text-right', filled.has(f.key) && ocrMsg && 'border-lime-400/50')}
                />
              </div>
            </div>
          ))}
        </div>
        {food.per100.kcal > 0 && computedKcal > 0 && Math.abs(computedKcal - food.per100.kcal) / food.per100.kcal > 0.2 && (
          <p className="mt-3 text-xs text-amber-400">
            Attention : les macros donnent ~{computedKcal} kcal/100 {food.unit}, ce qui ne colle pas avec l'énergie saisie. Vérifie les valeurs.
          </p>
        )}
      </Card>

      <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!valid} onClick={save}>
        Enregistrer l'aliment
      </Button>
      {id && (
        <Button variant="danger" className="mt-2 w-full" onClick={remove}>
          <Trash2 size={18} /> Supprimer l'aliment
        </Button>
      )}
    </Page>
  )
}
