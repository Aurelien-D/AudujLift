import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Lightbulb, Loader2, Share2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MuscleMap } from '../../components/MuscleMap'
import { SolarSigil } from '../../components/SolarSigil'
import { Button, Card, IconButton, Page, SectionTitle, Stat } from '../../components/ui'
import { db } from '../../lib/db'
import { useDoneWorkouts, useExerciseMap, useSettings } from '../../lib/hooks'
import { renderWeekRecap, shareRecap } from '../../lib/recap'
import { addDays, cn, formatDuration, formatNumber, formatShortDate, toISODate } from '../../lib/utils'
import { weekLabel, weekStart, weekSummary } from '../../lib/weekly'

export default function WeeklyRecap() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const ago = Math.max(0, Number(params.get('w') ?? 0) || 0)
  const setAgo = (n: number) => setParams(n ? { w: String(n) } : {}, { replace: true })
  const workouts = useDoneWorkouts()
  const exMap = useExerciseMap()
  const settings = useSettings()
  const start = useMemo(() => weekStart(ago), [ago])
  const from = addDays(toISODate(start), -7)
  const to = addDays(toISODate(start), 7)
  const entries = useLiveQuery(() => db.entries.where('date').between(from, to).toArray(), [from, to])
  const bodyweights = useLiveQuery(() => db.bodyweights.where('date').between(from, to).toArray(), [from, to])
  const [sharing, setSharing] = useState(false)

  const s = useMemo(
    () => (workouts && entries && bodyweights && exMap.size ? weekSummary({ start, workouts, exercises: exMap, entries, bodyweights, settings }) : undefined),
    [start, workouts, entries, bodyweights, exMap, settings],
  )

  const title = `Semaine ${weekLabel(start)}`
  if (!s)
    return (
      <Page back title="Bilan de la semaine">
        {null}
      </Page>
    )

  const volDelta = s.prevVolume > 0 ? Math.round(((s.volume - s.prevVolume) / s.prevVolume) * 100) : undefined
  const wDelta = s.weight.avg != null && s.weight.prevAvg != null ? s.weight.avg - s.weight.prevAvg : undefined
  const n = s.nutrition

  const share = async () => {
    setSharing(true)
    try {
      const lines = [
        { label: 'Volume soulevé', value: `${formatNumber(s.volume, 0)} kg${volDelta != null ? ` (${volDelta >= 0 ? '+' : ''}${volDelta} %)` : ''}` },
        ...(n.days ? [{ label: `Calories (moy. sur ${n.days} j)`, value: `${Math.round(n.kcal)} kcal` }] : []),
        ...(n.days ? [{ label: 'Protéines (moyenne)', value: `${Math.round(n.protein)} g` }] : []),
        ...(s.weight.avg != null
          ? [{ label: 'Poids moyen', value: `${formatNumber(s.weight.avg)} kg${wDelta != null ? ` (${wDelta >= 0 ? '+' : ''}${formatNumber(wDelta)})` : ''}` }]
          : []),
      ]
      const blob = await renderWeekRecap({
        title,
        stats: [
          ['Séances', `${s.sessions}/${s.goal}`],
          ['Temps', formatDuration(s.durationMs)],
          ['Records', String(s.records.length)],
        ],
        lines,
        records: s.records.map((r) => ({ label: `${exMap.get(r.hit.exerciseId)?.name ?? ''} · ${r.hit.label}`, value: r.hit.value })),
        tip: s.tip,
      })
      await shareRecap(blob, `audujlift-bilan-${toISODate(start)}.png`, title)
    } catch (e) {
      alert(`Partage impossible : ${(e as Error).message}`)
    } finally {
      setSharing(false)
    }
  }

  return (
    <Page back title="Bilan de la semaine">
      <div className="mb-3 flex items-center justify-between">
        <IconButton aria-label="Semaine précédente" onClick={() => setAgo(ago + 1)}>
          <ChevronLeft size={22} />
        </IconButton>
        <div className="text-center">
          <div className="font-display font-semibold">{ago === 0 ? 'Cette semaine' : ago === 1 ? 'Semaine dernière' : `Il y a ${ago} semaines`}</div>
          <div className="text-xs text-silver">{weekLabel(start)}</div>
        </div>
        <IconButton aria-label="Semaine suivante" disabled={ago === 0} onClick={() => setAgo(ago - 1)} className={cn(ago === 0 && 'opacity-30')}>
          <ChevronRight size={22} />
        </IconButton>
      </div>

      <Card glow className="relative overflow-hidden">
        <SolarSigil size={120} className="pointer-events-none absolute -top-8 -right-8 text-gold/[0.06]" />
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Séances" value={`${s.sessions}/${s.goal}`} accent={s.sessions >= s.goal} />
          <Stat label="Temps" value={formatDuration(s.durationMs)} />
          <Stat label="Volume" value={s.volume >= 10000 ? formatNumber(s.volume / 1000, 1) : formatNumber(s.volume, 0)} unit={s.volume >= 10000 ? 't' : 'kg'} />
        </div>
        {volDelta != null && s.sessions > 0 && (
          <p className="mt-2 text-xs text-silver">
            Volume <span className={volDelta >= 0 ? 'text-gold' : 'text-silver'}>{`${volDelta >= 0 ? '+' : ''}${volDelta} %`}</span> par rapport à la semaine précédente
          </p>
        )}
      </Card>

      <Card className="mt-3 border-gold/30">
        <div className="flex gap-3">
          <Lightbulb size={20} className="mt-0.5 shrink-0 text-gold" />
          <div className="text-sm">
            <div className="label text-gold">La semaine prochaine</div>
            <p className="mt-1 text-ivory">{s.tip}</p>
          </div>
        </div>
      </Card>

      {s.records.length > 0 && (
        <>
          <SectionTitle>Records</SectionTitle>
          <Card className="border-amethyst/40">
            <ul className="space-y-2 text-sm">
              {s.records.map(({ hit, date, workoutId }, i) => (
                <li key={i}>
                  <button onClick={() => navigate(`/workouts/history/${workoutId}`)} className="flex w-full items-center gap-3 text-left">
                    <Trophy size={14} className="shrink-0 text-amethyst-light" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ivory-dim">{exMap.get(hit.exerciseId)?.name}</span>
                      <span className="text-xs text-silver">
                        {hit.label} · {formatShortDate(date)}
                      </span>
                    </span>
                    <span className="font-display shrink-0 font-semibold text-gold">{hit.value}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle>Muscles travaillés</SectionTitle>
      <Card>
        <MuscleMap sets={s.muscles} />
      </Card>

      <SectionTitle>Nutrition et poids</SectionTitle>
      <Card className="grid grid-cols-3 gap-2">
        <Stat label="Jours suivis" value={`${n.days}/7`} />
        <Stat label="Moy. kcal" value={n.days ? Math.round(n.kcal) : '—'} />
        <Stat label="Moy. prot." value={n.days ? Math.round(n.protein) : '—'} unit={n.days ? 'g' : undefined} />
      </Card>
      {n.days > 0 && (
        <p className="mt-2 px-1 text-xs text-silver">
          Objectifs : {n.kcalGoal} kcal et {n.proteinGoal} g de protéines par jour.
        </p>
      )}
      <Card className="mt-3 flex items-center justify-between">
        <span className="text-sm text-silver">Poids moyen</span>
        <span className="font-display font-semibold">
          {s.weight.avg != null ? `${formatNumber(s.weight.avg)} kg` : '—'}
          {wDelta != null && (
            <span className="ml-2 text-sm font-normal text-silver">
              {wDelta >= 0 ? '+' : '−'}
              {formatNumber(Math.abs(wDelta))} kg
            </span>
          )}
        </span>
      </Card>

      <Button variant="primary" size="lg" className="mt-5 w-full" onClick={share} disabled={sharing}>
        {sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Partager le bilan
      </Button>
    </Page>
  )
}
