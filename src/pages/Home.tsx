import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Clock, Download, Dumbbell, Flame, Play, Plus, Scale, Settings as SettingsIcon, Sparkles, TrendingUp, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileAvatar, ProfileSwitcher } from '../components/ProfileSwitcher'
import { SolarSigil } from '../components/SolarSigil'
import { Stagnations } from '../components/Stagnations'
import { Button, Card, IconButton, SectionTitle } from '../components/ui'
import { downloadBlob, exportBackup } from '../lib/backup'
import { db, saveSettings } from '../lib/db'
import { MUSCLE_LABELS } from '../lib/exercises-data'
import { useActiveWorkout, useDoneWorkouts, useExerciseMap, useLatestBodyweight, useNow, useSettings } from '../lib/hooks'
import { activeProfile } from '../lib/profiles'
import { estimateDurationMin } from '../lib/progression'
import { needsBackup } from '../lib/reminders'
import { recentPRs, volumeBetween, weeklyStreak, workoutTotals } from '../lib/stats'
import type { MuscleGroup } from '../lib/types'
import { cn, formatClock, formatDate, formatDuration, formatNumber, formatShortDate, fromISODate, startOfWeek, toISODate } from '../lib/utils'
import { NutritionSummary } from './nutrition/Nutrition'
import { useStartWorkout } from './workout/Workouts'
import { sortRoutines } from '../lib/routine-order'

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY = 86400000

function daysAgo(ts: number) {
  const d = Math.round((fromISODate(toISODate()).getTime() - fromISODate(toISODate(new Date(ts))).getTime()) / DAY)
  return d <= 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} jours`
}

export default function Home() {
  const navigate = useNavigate()
  const settings = useSettings()
  const workouts = useDoneWorkouts()
  const active = useActiveWorkout()
  const exMap = useExerciseMap()
  const bw = useLatestBodyweight()
  const routines = useLiveQuery(() => db.routines.toArray(), [])
  const oldestEntry = useLiveQuery(async () => (await db.entries.orderBy('createdAt').first())?.createdAt, [])
  const start = useStartWorkout()
  const now = useNow(30000)
  const [switcher, setSwitcher] = useState(false)
  const profile = activeProfile()
  const name = settings.name || (profile.name !== 'Moi' ? profile.name : '')
  const list = useMemo(() => workouts ?? [], [workouts])

  const monday = startOfWeek(new Date()).getTime()
  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const iso = toISODate(new Date(monday + i * DAY + 3600000))
        return { iso, trained: list.some((w) => toISODate(new Date(w.startedAt)) === iso) }
      }),
    [list, monday],
  )
  const thisWeek = list.filter((w) => w.startedAt >= monday).length
  const streak = weeklyStreak(
    list.map((w) => w.startedAt),
    settings.weeklyWorkoutGoal,
  )
  const volume = useMemo(() => ({ now: volumeBetween(list, exMap, monday, Infinity), before: volumeBetween(list, exMap, monday - 7 * DAY, monday) }), [list, exMap, monday])
  const records = useMemo(() => recentPRs(list.slice(0, 40), exMap, Date.now() - 30 * DAY), [list, exMap])

  // Routine suggérée : celle utilisée il y a le plus longtemps (rotation naturelle d'un programme)
  const next = useMemo(() => {
    if (!routines?.length) return undefined
    // La moins récemment faite ; à égalité (jamais faites), la première dans l'ordre choisi par l'utilisateur
    return sortRoutines(routines).sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0))[0]
  }, [routines])
  const nextMuscles = useMemo(() => {
    const ms: MuscleGroup[] = []
    for (const e of next?.exercises ?? []) {
      const m = exMap.get(e.exerciseId)?.muscle
      if (m && !ms.includes(m)) ms.push(m)
    }
    return ms
  }, [next, exMap])

  const last = list[0]
  const hour = new Date().getHours()
  const hello = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const today = toISODate()
  const oldestData = Math.min(list.at(-1)?.startedAt ?? Infinity, oldestEntry ?? Infinity)
  const backupDue = needsBackup(settings.lastBackupAt, Number.isFinite(oldestData) ? oldestData : undefined)
  // Bilan proposé le dimanche soir (semaine en cours) et le lundi (semaine écoulée)
  const day = new Date(now).getDay()
  const recapReady = day === 0 && new Date(now).getHours() >= 17 ? 0 : day === 1 ? 1 : undefined
  const volDelta = volume.before > 0 ? Math.round(((volume.now - volume.before) / volume.before) * 100) : undefined

  return (
    <div className="animate-page mx-auto max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-36">
      <header className="mb-5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="label">{formatDate(Date.now())}</p>
          <h1 className="mt-1 text-2xl leading-tight font-semibold">
            {hello}
            {name ? <span className="text-gold">{` ${name}`}</span> : ''}
          </h1>
        </div>
        <SolarSigil size={22} className="text-gold/70" title="AudujLift" />
        <IconButton aria-label="Réglages" onClick={() => navigate('/profile')} className="text-silver">
          <SettingsIcon size={20} />
        </IconButton>
        <button aria-label="Changer de profil" onClick={() => setSwitcher(true)} className="press rounded-full ring-1 ring-line">
          <ProfileAvatar profile={profile} size="sm" />
        </button>
      </header>
      <ProfileSwitcher open={switcher} onClose={() => setSwitcher(false)} />

      {!settings.onboarded && (
        <Card className="mb-3 border-gold/30" onClick={() => navigate('/profile')}>
          <div className="flex items-center gap-3">
            <Sparkles className="shrink-0 text-gold" />
            <div className="flex-1">
              <div className="font-semibold">Configure ton profil</div>
              <div className="text-sm text-silver">Calcule tes besoins caloriques et tes objectifs de macros en 30 secondes.</div>
            </div>
            <ChevronRight className="text-silver" />
          </div>
        </Card>
      )}

      {backupDue && (
        <Card className="mb-3 border-warn/30">
          <div className="flex items-center gap-3">
            <Download size={20} className="shrink-0 text-warn" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-ivory">Pense à sauvegarder</div>
              <div className="text-silver">
                {settings.lastBackupAt ? `Dernière sauvegarde le ${formatShortDate(settings.lastBackupAt)}.` : 'Aucune sauvegarde pour le moment.'} Tes données ne vivent que sur ce
                téléphone.
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                downloadBlob(await exportBackup(), `audujlift-${toISODate()}.json`)
                await saveSettings({ lastBackupAt: Date.now() })
              }}
            >
              Exporter
            </Button>
          </div>
        </Card>
      )}

      {/* Séance du jour : la prochaine action est toujours visible */}
      {active ? (
        <Card glow className="relative overflow-hidden p-5">
          <SolarSigil size={140} className="pointer-events-none absolute -top-8 -right-8 text-gold/[0.06]" />
          <div className="label text-gold">Séance en cours</div>
          <h2 className="mt-1.5 text-2xl font-semibold">{active.name}</h2>
          <p className="mt-1 text-sm text-silver">
            Démarrée il y a {formatClock((now - active.startedAt) / 1000)} · {active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)} séries validées
          </p>
          <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => navigate('/workout/active')}>
            <Play size={18} /> Reprendre la séance
          </Button>
        </Card>
      ) : next ? (
        <Card glow className="relative overflow-hidden p-5">
          <SolarSigil size={140} className="pointer-events-none absolute -top-8 -right-8 text-gold/[0.06]" />
          <div className="label text-gold">Séance du jour</div>
          <h2 className="mt-1.5 text-2xl font-semibold">{next.name}</h2>
          {nextMuscles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {nextMuscles.slice(0, 4).map((m) => (
                <span key={m} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ivory-dim">
                  {MUSCLE_LABELS[m]}
                </span>
              ))}
              {nextMuscles.length > 4 && <span className="px-1 py-0.5 text-xs text-silver">+{nextMuscles.length - 4}</span>}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-silver">
            <span className="flex items-center gap-1.5">
              <Dumbbell size={14} className="text-gold" /> {next.exercises.length} exercice{next.exercises.length > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-gold" /> ~{estimateDurationMin(next.exercises)} min
            </span>
            {next.lastUsedAt && <span>Dernière fois {daysAgo(next.lastUsedAt)}</span>}
          </div>
          <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => start(next)}>
            <Play size={18} /> Commencer la séance
          </Button>
          <Button variant="tertiary" size="sm" className="mt-1 w-full" onClick={() => navigate('/workouts')}>
            Choisir une autre séance
          </Button>
        </Card>
      ) : (
        <Card glow className="p-5">
          <div className="label text-gold">Première séance</div>
          <h2 className="mt-1.5 text-xl font-semibold">Prêt à commencer ?</h2>
          <p className="mt-1 text-sm text-silver">Choisis un programme tout prêt, crée ta routine ou lance une séance libre.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => navigate('/workouts/programs')}>
              Programmes
            </Button>
            <Button variant="secondary" onClick={() => start()}>
              <Plus size={18} /> Séance libre
            </Button>
          </div>
        </Card>
      )}

      {recapReady != null && (
        <Card className="mt-3 border-gold/30" onClick={() => navigate(recapReady ? '/recap?w=1' : '/recap')}>
          <div className="flex items-center gap-3">
            <SolarSigil size={22} className="shrink-0 text-gold" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ivory">Ton bilan de la semaine est prêt</div>
              <div className="text-xs text-silver">Séances, records, muscles, nutrition et un conseil pour la suivante.</div>
            </div>
            <ChevronRight size={18} className="text-silver" />
          </div>
        </Card>
      )}

      {/* Progression */}
      <SectionTitle
        action={
          <button onClick={() => navigate('/recap')} className="text-sm font-medium text-gold">
            Bilan
          </button>
        }
      >
        Cette semaine
      </SectionTitle>
      <Card>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="label">Séances</div>
            <div className="font-display mt-1 text-2xl font-semibold">
              {thisWeek}
              <span className="text-base text-silver">/{settings.weeklyWorkoutGoal}</span>
            </div>
          </div>
          <div>
            <div className="label">Volume</div>
            <div className="font-display mt-1 text-2xl font-semibold">
              {volume.now >= 10000 ? formatNumber(volume.now / 1000, 1) : formatNumber(volume.now, 0)}
              <span className="ml-0.5 text-sm text-silver">{volume.now >= 10000 ? 't' : 'kg'}</span>
            </div>
            {volDelta != null && thisWeek > 0 && (
              <div className={cn('text-xs', volDelta >= 0 ? 'text-gold' : 'text-silver')}>
                {volDelta >= 0 ? '+' : ''}
                {volDelta} % vs sem. dern.
              </div>
            )}
          </div>
          <div>
            <div className="label">Régularité</div>
            <div className="font-display mt-1 flex items-center gap-1 text-2xl font-semibold">
              <Flame size={18} className={streak > 0 ? 'text-gold' : 'text-silver-dim'} />
              {streak}
              <span className="text-sm text-silver">sem.</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {week.map((d, i) => (
            <div key={d.iso} className="flex flex-col items-center gap-1.5">
              <span className={cn('text-[11px]', d.iso === today ? 'font-semibold text-gold' : 'text-silver')}>{DAY_LETTERS[i]}</span>
              <div
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-colors',
                  d.trained ? 'bg-gold text-ink' : d.iso === today ? 'border border-gold/50' : 'bg-raised/70',
                )}
              >
                {d.trained && <SolarSigil size={16} />}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {records.length > 0 && (
        <Card className="mt-3 border-amethyst/40">
          <div className="mb-2 flex items-center gap-2">
            <Trophy size={16} className="text-amethyst-light" />
            <span className="label text-amethyst-light">Records récents</span>
          </div>
          <ul className="space-y-2">
            {records.slice(0, 3).map(({ hit, date, workoutId }, i) => (
              <li key={i}>
                <button onClick={() => navigate(`/workouts/history/${workoutId}`)} className="flex w-full items-center gap-3 text-left text-sm">
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
      )}

      <div className="mt-3">
        <Stagnations limit={1} />
      </div>

      {/* Nutrition */}
      <SectionTitle
        action={
          <button onClick={() => navigate('/nutrition/add')} className="text-sm font-medium text-gold">
            + Ajouter
          </button>
        }
      >
        Nutrition du jour
      </SectionTitle>
      <div onClick={() => navigate('/nutrition')} className="cursor-pointer">
        <NutritionSummary date={today} compact />
      </div>

      {/* Dernière séance + poids */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card onClick={() => last && navigate(`/workouts/history/${last.id}`)} className="p-3.5">
          <div className="label">Dernière séance</div>
          {last ? (
            <>
              <div className="mt-1 truncate font-medium">{last.name}</div>
              <div className="text-xs text-silver">
                {daysAgo(last.startedAt)} · {formatDuration(workoutTotals(last, exMap).durationMs)}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-silver">Aucune pour l'instant</div>
          )}
        </Card>
        <Card onClick={() => navigate('/progress')} className="p-3.5">
          <div className="label flex items-center gap-1">
            <Scale size={11} /> Poids
          </div>
          <div className="font-display mt-1 text-xl font-semibold">{bw ? `${formatNumber(bw)} kg` : '—'}</div>
          <div className="flex items-center gap-1 text-xs text-gold">
            {bw ? (
              <>
                <TrendingUp size={12} /> Voir la courbe
              </>
            ) : (
              'Ajouter ma pesée'
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
