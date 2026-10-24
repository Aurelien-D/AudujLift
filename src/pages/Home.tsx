import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Flame, Play, Plus, Scale, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileAvatar, ProfileSwitcher } from '../components/ProfileSwitcher'
import { Button, Card, SectionTitle } from '../components/ui'
import { db } from '../lib/db'
import { useDoneWorkouts, useExerciseMap, useLatestBodyweight, useSettings } from '../lib/hooks'
import { activeProfile } from '../lib/profiles'
import { weeklyStreak, workoutTotals } from '../lib/stats'
import { cn, formatDate, formatDuration, formatNumber, startOfWeek, toISODate } from '../lib/utils'
import { NutritionSummary } from './nutrition/Nutrition'
import { useStartWorkout } from './workout/Workouts'

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function Home() {
  const navigate = useNavigate()
  const settings = useSettings()
  const workouts = useDoneWorkouts()
  const exMap = useExerciseMap()
  const bw = useLatestBodyweight()
  const routines = useLiveQuery(() => db.routines.toArray(), [])
  const start = useStartWorkout()
  const [switcher, setSwitcher] = useState(false)
  const profile = activeProfile()
  const name = settings.name || (profile.name !== 'Moi' ? profile.name : '')

  const week = useMemo(() => {
    const monday = startOfWeek(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      const iso = toISODate(d)
      return { iso, trained: (workouts ?? []).some((w) => toISODate(new Date(w.startedAt)) === iso) }
    })
  }, [workouts])
  const thisWeek = (workouts ?? []).filter((w) => w.startedAt >= startOfWeek(new Date()).getTime()).length
  const streak = weeklyStreak(
    (workouts ?? []).map((w) => w.startedAt),
    settings.weeklyWorkoutGoal,
  )

  // Routine suggérée : celle utilisée il y a le plus longtemps (rotation naturelle d'un programme)
  const next = useMemo(() => {
    if (!routines?.length) return undefined
    return [...routines].sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0) || a.createdAt - b.createdAt)[0]
  }, [routines])

  const last = workouts?.[0]
  const hour = new Date().getHours()
  const hello = hour < 5 ? 'Bonne nuit' : hour < 18 ? 'Salut' : 'Bonsoir'
  const today = toISODate()

  return (
    <div className="pt-safe mx-auto max-w-xl px-4 pt-6 pb-36">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">{formatDate(Date.now())}</p>
          <h1 className="text-2xl font-black">
            {hello}
            {name ? ` ${name}` : ''} 👋
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-gradient text-xl font-black tracking-tight">AudujLift</div>
          <button aria-label="Changer de profil" onClick={() => setSwitcher(true)} className="rounded-full ring-2 ring-zinc-800 active:scale-95">
            <ProfileAvatar profile={profile} size="sm" />
          </button>
        </div>
      </header>
      <ProfileSwitcher open={switcher} onClose={() => setSwitcher(false)} />

      {!settings.onboarded && (
        <Card className="mb-4 border-lime-400/30 bg-lime-400/5" onClick={() => navigate('/profile')}>
          <div className="flex items-center gap-3">
            <Sparkles className="shrink-0 text-lime-400" />
            <div className="flex-1">
              <div className="font-semibold">Configure ton profil</div>
              <div className="text-sm text-zinc-400">Calcule tes besoins caloriques et tes objectifs de macros en 30 secondes.</div>
            </div>
            <ChevronRight className="text-zinc-400" />
          </div>
        </Card>
      )}

      {/* Semaine */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400">Cette semaine</div>
            <div className="text-lg font-bold">
              {thisWeek}/{settings.weeklyWorkoutGoal} séances
            </div>
          </div>
          <div className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold', streak > 0 ? 'bg-orange-500/15 text-orange-400' : 'bg-zinc-800 text-zinc-400')}>
            <Flame size={16} /> {streak} sem.
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {week.map((d, i) => (
            <div key={d.iso} className="flex flex-col items-center gap-1">
              <span className={cn('text-[11px]', d.iso === today ? 'font-bold text-lime-400' : 'text-zinc-400')}>{DAY_LETTERS[i]}</span>
              <div
                className={cn(
                  'flex size-8 items-center justify-center rounded-full',
                  d.trained ? 'bg-gradient-accent text-zinc-950' : d.iso === today ? 'border border-lime-400/50' : 'bg-zinc-800/80',
                )}
              >
                {d.trained && <Flame size={14} />}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Démarrer */}
      <SectionTitle>Entraînement</SectionTitle>
      {next ? (
        <Card>
          <div className="text-xs text-zinc-400">Prochaine séance suggérée</div>
          <div className="mt-0.5 text-lg font-bold">{next.name}</div>
          <div className="truncate text-sm text-zinc-400">
            {next.exercises
              .map((e) => exMap.get(e.exerciseId)?.name)
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <Button variant="primary" onClick={() => start(next)}>
              <Play size={18} /> Démarrer
            </Button>
            <Button variant="secondary" onClick={() => navigate('/workouts')}>
              Autre
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-zinc-400">Crée ta première routine ou importe un programme pour commencer.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => navigate('/workouts/programs')}>
              Programmes
            </Button>
            <Button variant="secondary" onClick={() => start()}>
              <Plus size={18} /> Séance libre
            </Button>
          </div>
        </Card>
      )}

      {/* Nutrition */}
      <SectionTitle
        action={
          <button onClick={() => navigate('/nutrition/add')} className="text-sm font-medium text-lime-400">
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
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Card onClick={() => last && navigate(`/workouts/history/${last.id}`)} className="p-3">
          <div className="text-xs text-zinc-400">Dernière séance</div>
          {last ? (
            <>
              <div className="mt-0.5 truncate font-semibold">{last.name}</div>
              <div className="text-xs text-zinc-400">
                {formatDuration(workoutTotals(last, exMap).durationMs)} · {formatNumber(workoutTotals(last, exMap).volume, 0)} kg
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-zinc-400">Aucune</div>
          )}
        </Card>
        <Card onClick={() => navigate('/progress')} className="p-3">
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <Scale size={12} /> Poids
          </div>
          <div className="mt-0.5 text-xl font-bold">{bw ? `${formatNumber(bw)} kg` : '—'}</div>
          <div className="text-xs text-lime-400">{bw ? 'Voir la courbe' : 'Ajouter ma pesée'}</div>
        </Card>
      </div>
    </div>
  )
}
