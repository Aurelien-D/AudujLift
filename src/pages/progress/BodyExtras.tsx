import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Columns2, Plus, Ruler, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { TrendChart } from '../../components/charts'
import { Button, Card, Chip, EmptyState, Field, IconButton, NumberInput, SectionTitle, Sheet, Tabs } from '../../components/ui'
import { db } from '../../lib/db'
import { compressImage } from '../../lib/image'
import type { Measurement, ProgressPhoto } from '../../lib/types'
import { cn, formatNumber, formatShortDate, fromISODate, toISODate, uid } from '../../lib/utils'

type MeasureKey = Exclude<keyof Measurement, 'id' | 'date'>

const MEASURES: { key: MeasureKey; label: string; unit: string }[] = [
  { key: 'waist', label: 'Tour de taille', unit: 'cm' },
  { key: 'chest', label: 'Poitrine', unit: 'cm' },
  { key: 'shoulders', label: 'Épaules', unit: 'cm' },
  { key: 'arm', label: 'Bras', unit: 'cm' },
  { key: 'thigh', label: 'Cuisse', unit: 'cm' },
  { key: 'hips', label: 'Hanches', unit: 'cm' },
  { key: 'calf', label: 'Mollet', unit: 'cm' },
  { key: 'neck', label: 'Cou', unit: 'cm' },
  { key: 'bodyFat', label: 'Masse grasse', unit: '%' },
]

/** Dernière valeur connue de chaque mesure, et son écart avec la première. */
function latestMeasures(list: Measurement[]) {
  const out = new Map<MeasureKey, { value: number; date: string; delta?: number }>()
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
  for (const m of MEASURES) {
    const xs = sorted.filter((x) => x[m.key] != null)
    if (!xs.length) continue
    const last = xs[xs.length - 1]
    out.set(m.key, { value: last[m.key]!, date: last.date, delta: xs.length > 1 ? last[m.key]! - xs[0][m.key]! : undefined })
  }
  return out
}

export function Measurements() {
  const list = useLiveQuery(() => db.measurements.orderBy('date').toArray(), [])
  const [form, setForm] = useState(false)
  const [chart, setChart] = useState<MeasureKey>('waist')
  const latest = latestMeasures(list ?? [])
  const data = (list ?? []).filter((m) => m[chart] != null).map((m) => ({ date: fromISODate(m.date).getTime(), value: m[chart]! }))
  const shown = MEASURES.filter((m) => latest.has(m.key))
  const unit = MEASURES.find((m) => m.key === chart)!.unit

  return (
    <>
      <SectionTitle
        action={
          <Button variant="tertiary" size="sm" onClick={() => setForm(true)}>
            <Plus size={16} /> Mesurer
          </Button>
        }
      >
        Mensurations
      </SectionTitle>
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<Ruler size={36} className="text-gold/70" />} title="Aucune mensuration">
            Le tour de taille ou de bras révèle souvent la progression mieux que la balance.
          </EmptyState>
        </Card>
      ) : (
        <Card className="p-3">
          <div className="grid grid-cols-3 gap-2">
            {shown.map((m) => {
              const v = latest.get(m.key)!
              return (
                <button
                  key={m.key}
                  onClick={() => setChart(m.key)}
                  className={cn('press rounded-xl border p-2 text-left', chart === m.key ? 'border-gold/50 bg-gold/8' : 'border-line/70 bg-raised/40')}
                >
                  <div className="truncate text-[11px] text-silver">{m.label}</div>
                  <div className="font-display text-lg font-semibold text-ivory">
                    {formatNumber(v.value)}
                    <span className="ml-0.5 text-xs font-normal text-silver">{m.unit}</span>
                  </div>
                  {v.delta != null && v.delta !== 0 && (
                    <div className="text-[11px] text-silver">
                      {v.delta > 0 ? '+' : '−'}
                      {formatNumber(Math.abs(v.delta))} {m.unit}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {data.length >= 2 && (
            <div className="mt-3">
              <TrendChart data={data} unit={unit} height={150} />
            </div>
          )}
        </Card>
      )}
      {form && <MeasurementForm last={list?.at(-1)} onClose={() => setForm(false)} />}
    </>
  )
}

function MeasurementForm({ last, onClose }: { last?: Measurement; onClose: () => void }) {
  const [date, setDate] = useState(toISODate())
  const [values, setValues] = useState<Partial<Record<MeasureKey, number>>>({})
  const filled = Object.values(values).some((v) => v != null)
  const save = async () => {
    const existing = await db.measurements.where('date').equals(date).first()
    await db.measurements.put({ ...existing, ...values, id: existing?.id ?? uid(), date })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title="Nouvelles mensurations">
      <div className="space-y-3">
        <Field label="Date">
          <input
            type="date"
            value={date}
            max={toISODate()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-ink px-3 text-ivory"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          {MEASURES.map((m) => (
            <Field key={m.key} label={`${m.label} (${m.unit})`}>
              <NumberInput
                value={values[m.key]}
                onChange={(v) => setValues((s) => ({ ...s, [m.key]: v }))}
                placeholder={last?.[m.key] != null ? String(last[m.key]).replace('.', ',') : ''}
              />
            </Field>
          ))}
        </div>
        <p className="text-xs text-silver">Mesure au même moment de la journée (idéalement le matin), ruban à plat, sans serrer.</p>
        <Button variant="primary" size="lg" className="w-full" disabled={!filled} onClick={save}>
          Enregistrer
        </Button>
      </div>
    </Sheet>
  )
}

const POSE_LABELS: Record<ProgressPhoto['pose'], string> = { front: 'Face', side: 'Profil', back: 'Dos' }

export function ProgressPhotos() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front')
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null)
  const [compare, setCompare] = useState<string[] | null>(null)
  const list = (photos ?? []).filter((p) => p.pose === pose)

  const add = async (file: File) => {
    setBusy(true)
    try {
      const dataUrl = await compressImage(file, 1080, 0.78)
      await db.photos.add({ id: uid(), date: toISODate(), pose, dataUrl, createdAt: Date.now() })
    } catch {
      alert('Impossible de lire cette photo. Essaie avec une autre image (JPEG ou PNG).')
    } finally {
      setBusy(false)
    }
  }

  const pickForCompare = (p: ProgressPhoto) => {
    if (!compare) return setViewing(p)
    const next = compare.includes(p.id) ? compare.filter((id) => id !== p.id) : [...compare, p.id].slice(-2)
    setCompare(next)
  }
  const pair = compare?.length === 2 ? compare.map((id) => list.find((p) => p.id === id)!).sort((a, b) => a.date.localeCompare(b.date)) : null

  return (
    <>
      <SectionTitle
        action={
          list.length >= 2 && (
            <Button variant="tertiary" size="sm" onClick={() => setCompare(compare ? null : [])}>
              <Columns2 size={16} /> {compare ? 'Annuler' : 'Comparer'}
            </Button>
          )
        }
      >
        Photos de progression
      </SectionTitle>
      <Card className="p-3">
        <Tabs value={pose} onChange={setPose} tabs={(Object.keys(POSE_LABELS) as ProgressPhoto['pose'][]).map((value) => ({ value, label: POSE_LABELS[value] }))} />
        {compare && <p className="mt-2 text-xs text-gold-pale">Choisis deux photos à comparer ({compare.length}/2).</p>}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="press flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gold/40 text-xs text-gold active:bg-gold/10"
          >
            <Camera size={22} />
            {busy ? 'Ajout…' : 'Ajouter'}
          </button>
          {list.map((p) => (
            <button
              key={p.id}
              onClick={() => pickForCompare(p)}
              className={cn('press relative aspect-[3/4] overflow-hidden rounded-xl border', compare?.includes(p.id) ? 'border-gold ring-2 ring-gold/50' : 'border-line/70')}
            >
              <img src={p.dataUrl} alt={`${POSE_LABELS[p.pose]} du ${formatShortDate(fromISODate(p.date))}`} className="size-full object-cover" loading="lazy" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-1.5 pt-4 pb-1 text-left text-[11px] text-ivory">
                {formatShortDate(fromISODate(p.date))}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-silver-dim">Les photos restent sur ton téléphone. Même lumière, même distance, même pose : la comparaison n'en sera que plus parlante.</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void add(f)
          }}
        />
      </Card>

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${POSE_LABELS[viewing.pose]} · ${formatShortDate(fromISODate(viewing.date))}` : ''}>
        {viewing && (
          <>
            <img src={viewing.dataUrl} alt="" className="w-full rounded-xl" />
            <div className="mt-3 flex items-center gap-2">
              <input
                type="date"
                aria-label="Date de la photo"
                value={viewing.date}
                max={toISODate()}
                onChange={async (e) => {
                  if (!e.target.value) return
                  await db.photos.update(viewing.id, { date: e.target.value })
                  setViewing({ ...viewing, date: e.target.value })
                }}
                className="h-11 flex-1 rounded-xl border border-line bg-ink px-3 text-ivory"
              />
              <IconButton
                aria-label="Supprimer la photo"
                className="text-danger"
                onClick={async () => {
                  if (!confirm('Supprimer cette photo ?')) return
                  await db.photos.delete(viewing.id)
                  setViewing(null)
                }}
              >
                <Trash2 size={20} />
              </IconButton>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={!!pair} onClose={() => setCompare(null)} title="Avant / après" full>
        {pair && (
          <div className="grid grid-cols-2 gap-2">
            {pair.map((p, i) => (
              <figure key={p.id}>
                <img src={p.dataUrl} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
                <figcaption className="mt-1.5 text-center text-sm">
                  <span className={i ? 'text-gold' : 'text-silver'}>{i ? 'Après' : 'Avant'}</span> · {formatShortDate(fromISODate(p.date))}
                </figcaption>
              </figure>
            ))}
            <div className="col-span-2 mt-1 flex justify-center">
              <Chip>{Math.round((fromISODate(pair[1].date).getTime() - fromISODate(pair[0].date).getTime()) / 86400000)} jours d'écart</Chip>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}
