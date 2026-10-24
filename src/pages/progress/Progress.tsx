import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarsChart, TrendChart } from '../../components/charts'
import { Measurements, ProgressPhotos } from './BodyExtras'
import { MuscleMap } from '../../components/MuscleMap'
import { RankBadge, RankProgress } from '../../components/RankBadge'
import { Stagnations } from '../../components/Stagnations'
import { Button, Card, EmptyState, IconButton, NumberInput, Page, SectionTitle, Stat, Tabs } from '../../components/ui'
import { db } from '../../lib/db'
import { MUSCLE_LABELS } from '../../lib/exercises-data'
import { useDoneWorkouts, useExerciseMap, useExercises, useLatestBodyweight, useSettings } from '../../lib/hooks'
import { muscleSets as countMuscleSets } from '../../lib/insights'
import { sumNutrients } from '../../lib/nutrition'
import { bodyRegion, computeRank, exerciseHistory, personalRecords, rankFromScore, RANKS, workoutTotals, type RankResult } from '../../lib/stats'
import type { Exercise, MuscleGroup } from '../../lib/types'
import { addDays, formatDuration, formatNumber, formatShortDate, fromISODate, startOfWeek, toISODate, uid } from '../../lib/utils'

type Tab = 'body' | 'ranks' | 'stats'

export default function Progress() {
  const [tab, setTab] = useState<Tab>('body')
  return (
    <Page title="Progrès">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'body', label: 'Corps' },
          { value: 'ranks', label: 'Rangs' },
          { value: 'stats', label: 'Stats' },
        ]}
      />
      <div className="mt-4">
        {tab === 'body' && <BodyTab />}
        {tab === 'ranks' && <RanksTab />}
        {tab === 'stats' && <StatsTab />}
      </div>
    </Page>
  )
}

function BodyTab() {
  const entries = useLiveQuery(() => db.bodyweights.orderBy('date').toArray(), [])
  const [weight, setWeight] = useState<number>()
  const [date, setDate] = useState(toISODate())
  const [range, setRange] = useState<'30' | '90' | 'all'>('90')

  const add = async () => {
    if (!weight) return
    const existing = await db.bodyweights.where('date').equals(date).first()
    await db.bodyweights.put({ id: existing?.id ?? uid(), date, weight })
    setWeight(undefined)
  }

  const list = entries ?? []
  const from = range === 'all' ? '' : addDays(toISODate(), -Number(range))
  const data = list.filter((e) => e.date >= from).map((e) => ({ date: fromISODate(e.date).getTime(), value: e.weight }))
  const last = list.at(-1)
  const avg = (days: number, offset = 0) => {
    const end = addDays(toISODate(), -offset)
    const start = addDays(end, -days)
    const xs = list.filter((e) => e.date > start && e.date <= end).map((e) => e.weight)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined
  }
  const avg7 = avg(7)
  const prev7 = avg(7, 7)
  const delta = avg7 != null && prev7 != null ? avg7 - prev7 : undefined

  return (
    <>
      <Card>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs text-silver">Nouvelle pesée (kg)</div>
            <NumberInput aria-label="Poids (kg)" value={weight} onChange={setWeight} placeholder={last ? String(last.weight).replace('.', ',') : '75,0'} />
          </div>
          <input
            type="date"
            aria-label="Date de la pesée"
            value={date}
            max={toISODate()}
            onChange={(e) => setDate(e.target.value)}
            className="h-[46px] rounded-xl border border-line bg-ink px-2 text-sm text-ivory"
          />
          <Button variant="primary" className="h-[46px]" disabled={!weight} onClick={add}>
            OK
          </Button>
        </div>
      </Card>

      <Card className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Actuel" value={last ? formatNumber(last.weight) : '—'} unit="kg" />
        <Stat label="Moy. 7 j" value={avg7 ? formatNumber(avg7) : '—'} unit="kg" />
        <Stat
          label="vs sem. préc."
          value={delta != null ? <span className={delta > 0 ? 'text-warn' : 'text-gold-pale'}>{`${delta > 0 ? '+' : ''}${formatNumber(delta)}`}</span> : '—'}
          unit="kg"
        />
      </Card>

      <Card className="mt-3 p-3">
        <Tabs
          value={range}
          onChange={setRange}
          tabs={[
            { value: '30', label: '30 j' },
            { value: '90', label: '3 mois' },
            { value: 'all', label: 'Tout' },
          ]}
        />
        <div className="mt-3">
          <TrendChart data={data} unit="kg" />
        </div>
      </Card>

      <Measurements />
      <ProgressPhotos />

      {list.length > 0 && (
        <>
          <SectionTitle>Pesées</SectionTitle>
          <Card className="p-0">
            {[...list]
              .reverse()
              .slice(0, 30)
              .map((e) => (
                <div key={e.id} className="flex items-center border-b border-raised/60 px-4 py-2 last:border-0">
                  <span className="flex-1 text-sm text-ivory-dim">{formatShortDate(fromISODate(e.date))}</span>
                  <span className="font-semibold">{formatNumber(e.weight)} kg</span>
                  <IconButton aria-label="Supprimer" onClick={() => db.bodyweights.delete(e.id)} className="ml-2 text-silver">
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              ))}
          </Card>
        </>
      )}
    </>
  )
}

function RanksTab() {
  const navigate = useNavigate()
  const exercises = useExercises()
  const workouts = useDoneWorkouts()
  const bw = useLatestBodyweight()
  const settings = useSettings()

  const ranked = useMemo(() => {
    if (!exercises || !workouts || !bw) return []
    const out: { ex: Exercise; rank: RankResult; e1rm: number }[] = []
    for (const ex of exercises) {
      if (!ex.standard) continue
      const pr = personalRecords(exerciseHistory(ex, workouts, bw))
      if (!pr.bestE1rm) continue
      const rank = computeRank(pr.bestE1rm.value, ex.standard, { sex: settings.sex, bodyweight: bw, heightCm: settings.heightCm }, bodyRegion(ex))
      if (rank) out.push({ ex, rank, e1rm: pr.bestE1rm.value })
    }
    return out.sort((a, b) => b.rank.score - a.rank.score)
  }, [exercises, workouts, bw, settings.sex, settings.heightCm])

  const byMuscle = useMemo(() => {
    const m = new Map<MuscleGroup, (typeof ranked)[number]>()
    for (const r of ranked) {
      const cur = m.get(r.ex.muscle)
      if (!cur || r.rank.score > cur.rank.score) m.set(r.ex.muscle, r)
    }
    return m
  }, [ranked])

  if (!bw)
    return (
      <EmptyState title="Ajoute ton poids de corps">
        Les rangs comparent ta force (1RM estimé) en tenant compte de ton sexe, de ton poids et de ta taille. Renseigne une pesée dans l'onglet « Corps ».
      </EmptyState>
    )
  if (!ranked.length)
    return (
      <EmptyState title="Pas encore de rang">
        Termine une séance avec des exercices de base (développé couché, squat, soulevé de terre, tractions…) pour débloquer tes rangs.
      </EmptyState>
    )

  const overall: RankResult = rankFromScore([...byMuscle.values()].reduce((s, r) => s + r.rank.score, 0) / byMuscle.size)

  return (
    <>
      <Card className="flex items-center gap-4">
        <RankBadge result={overall} size="lg" />
        <div className="flex-1">
          <div className="text-xs text-silver">Rang global</div>
          <div className="font-display text-2xl font-semibold" style={{ color: overall.rank.color }}>
            {overall.label}
          </div>
          <div className="mt-1">
            <RankProgress result={overall} />
          </div>
        </div>
      </Card>

      <SectionTitle>Par groupe musculaire</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(MUSCLE_LABELS) as MuscleGroup[])
          .filter((m) => m !== 'cardio')
          .map((m) => {
            const r = byMuscle.get(m)
            return (
              <Card key={m} className="flex items-center gap-2 p-3">
                {r ? <RankBadge result={r.rank} size="sm" /> : <div className="size-8 rounded-lg border border-dashed border-line" />}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{MUSCLE_LABELS[m]}</div>
                  <div className="text-xs" style={{ color: r?.rank.rank.color ?? '#6a6f7b' }}>
                    {r?.rank.label ?? 'Non classé'}
                  </div>
                </div>
              </Card>
            )
          })}
      </div>

      <SectionTitle>Par exercice</SectionTitle>
      <div className="space-y-2">
        {ranked.map(({ ex, rank, e1rm }) => (
          <Card key={ex.id} className="flex items-center gap-3 p-3" onClick={() => navigate(`/exercises/${ex.id}`)}>
            <RankBadge result={rank} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{ex.name}</div>
              <div className="text-xs text-silver">
                1RM ~{formatNumber(e1rm, 0)} kg · {formatNumber(rank.ratio, 2)}× ton poids
              </div>
              <div className="mt-1.5">
                <RankProgress result={rank} />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <RanksExplainer heightKnown={!!settings.heightCm} />
    </>
  )
}

/** Échelle des rangs et méthode de calcul, repliée sous la liste. */
function RanksExplainer({ heightKnown }: { heightKnown: boolean }) {
  const navigate = useNavigate()
  return (
    <details className="mt-5 rounded-2xl border border-line/70 bg-surface p-4 text-sm text-silver">
      <summary className="cursor-pointer font-medium text-ivory-dim">Comment sont calculés les rangs ?</summary>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {RANKS.map((r) => (
          <span key={r.key} className="rounded-full border px-2 py-0.5 text-xs" style={{ color: r.color, borderColor: `${r.color}55` }}>
            {r.name}
          </span>
        ))}
      </div>
      <p className="mt-3">
        Du Bronze au Diamant, chaque rang a 4 divisions (IV → I). Maître, Grand Maître et Challenger n'en ont pas : Challenger correspond au niveau des meilleurs athlètes de force.
      </p>
      <p className="mt-2">Ton 1RM estimé (meilleure série) est ramené à celui d'un homme de 80 kg et 1,76 m de même niveau, puis comparé au standard de l'exercice :</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>
          <span className="text-ivory-dim">Sexe et poids</span> : formule DOTS, utilisée en compétition de force athlétique. Les plus lourds ne sont pas pénalisés comme avec un
          simple « × ton poids ».
        </li>
        <li>
          <span className="text-ivory-dim">Haut / bas du corps</span> : pour les femmes, l'écart est plus marqué sur le haut du corps ; les standards en tiennent compte.
        </li>
        <li>
          <span className="text-ivory-dim">Taille</span> : à poids égal, une personne plus grande a des leviers plus longs ; correction modérée, au plus ±8 %.
        </li>
      </ul>
      {!heightKnown && (
        <button onClick={() => navigate('/profile')} className="mt-3 text-gold underline-offset-2 active:underline">
          Renseigne ta taille dans le profil pour un rang plus juste
        </button>
      )}
      <p className="mt-3 text-xs text-silver-dim">Standards indicatifs : ils servent à se situer et à progresser, pas à se juger.</p>
    </details>
  )
}

function StatsTab() {
  const navigate = useNavigate()
  const workouts = useDoneWorkouts()
  const exMap = useExerciseMap()
  const settings = useSettings()
  const since7 = addDays(toISODate(), -6)
  const [week, setWeek] = useState<'0' | '1'>('0')
  const weekSets = useMemo(() => {
    const monday = startOfWeek(new Date())
    monday.setDate(monday.getDate() - Number(week) * 7)
    const end = new Date(monday)
    end.setDate(end.getDate() + 7)
    return countMuscleSets(workouts ?? [], exMap, monday.getTime(), end.getTime())
  }, [workouts, exMap, week])
  const entries = useLiveQuery(() => db.entries.where('date').aboveOrEqual(since7).toArray(), [since7])

  const totals = useMemo(() => {
    let volume = 0
    let duration = 0
    for (const w of workouts ?? []) {
      const t = workoutTotals(w, exMap)
      volume += t.volume
      duration += t.durationMs
    }
    return { count: workouts?.length ?? 0, volume, duration }
  }, [workouts, exMap])

  const perWeek = useMemo(() => {
    const monday = startOfWeek(new Date())
    return Array.from({ length: 12 }, (_, i) => {
      const start = new Date(monday)
      start.setDate(start.getDate() - (11 - i) * 7)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const n = (workouts ?? []).filter((w) => w.startedAt >= start.getTime() && w.startedAt < end.getTime()).length
      return { label: formatShortDate(start), n }
    })
  }, [workouts])

  const muscleSets = useMemo(() => {
    const since = Date.now() - 30 * 86400000
    const m = new Map<MuscleGroup, number>()
    for (const w of workouts ?? []) {
      if (w.startedAt < since) continue
      for (const e of w.exercises) {
        const ex = exMap.get(e.exerciseId)
        if (!ex) continue
        const n = e.sets.filter((s) => s.done && s.type !== 'warmup').length
        m.set(ex.muscle, (m.get(ex.muscle) ?? 0) + n)
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [workouts, exMap])
  const maxSets = Math.max(1, ...muscleSets.map(([, n]) => n))

  const nutrition = useMemo(() => {
    const days = new Map<string, number>()
    for (const e of entries ?? []) days.set(e.date, (days.get(e.date) ?? 0) + e.nutrients.kcal)
    const tracked = [...days.values()]
    const all = sumNutrients((entries ?? []).map((e) => e.nutrients))
    const n = days.size || 1
    return { days: days.size, kcal: tracked.reduce((a, b) => a + b, 0) / n, protein: all.protein / n }
  }, [entries])

  return (
    <>
      <SectionTitle
        action={
          <button onClick={() => navigate('/recap')} className="text-sm font-medium text-gold">
            Bilan de la semaine
          </button>
        }
      >
        Muscles travaillés
      </SectionTitle>
      <Card>
        <Tabs
          value={week}
          onChange={setWeek}
          tabs={[
            { value: '0', label: 'Cette semaine' },
            { value: '1', label: 'Semaine dernière' },
          ]}
        />
        <div className="mt-3">
          <MuscleMap sets={weekSets} />
        </div>
      </Card>

      <div className="mt-3">
        <Stagnations limit={5} />
      </div>

      <SectionTitle>Depuis le début</SectionTitle>
      <Card className="grid grid-cols-3 gap-2">
        <Stat label="Séances" value={totals.count} />
        <Stat label="Volume total" value={formatNumber(totals.volume / 1000, 1)} unit="t" />
        <Stat label="Temps" value={formatDuration(totals.duration)} />
      </Card>

      <SectionTitle>Séances par semaine</SectionTitle>
      <Card className="p-3">
        <BarsChart data={perWeek} dataKey="n" labelKey="label" format={(v) => `${v} séance${v > 1 ? 's' : ''}`} />
      </Card>

      <SectionTitle>Séries par muscle (30 jours)</SectionTitle>
      <Card className="space-y-2">
        {muscleSets.length === 0 && <p className="text-sm text-silver">Aucune séance ces 30 derniers jours.</p>}
        {muscleSets.map(([m, n]) => (
          <div key={m} className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 truncate text-ivory-dim">{MUSCLE_LABELS[m]}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-gold" style={{ width: `${(n / maxSets) * 100}%` }} />
            </div>
            <span className="w-8 text-right font-semibold">{n}</span>
          </div>
        ))}
      </Card>

      <SectionTitle>Nutrition (7 derniers jours)</SectionTitle>
      <Card className="grid grid-cols-3 gap-2">
        <Stat label="Jours suivis" value={`${nutrition.days}/7`} />
        <Stat label="Moy. kcal" value={nutrition.days ? Math.round(nutrition.kcal) : '—'} />
        <Stat label="Moy. protéines" value={nutrition.days ? Math.round(nutrition.protein) : '—'} unit="g" />
      </Card>
      {nutrition.days > 0 && (
        <p className="mt-2 text-xs text-silver">
          Objectif : {settings.goals.kcal} kcal et {settings.goals.protein} g de protéines par jour.
        </p>
      )}
    </>
  )
}
