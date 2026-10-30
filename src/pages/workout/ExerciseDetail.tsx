import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, Pencil, Trash2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TrendChart } from '../../components/charts'
import { ExerciseGuide } from '../../components/ExerciseGuide'
import { ExerciseForm } from '../../components/ExercisePicker'
import { RankBadge, RankProgress } from '../../components/RankBadge'
import { Button, Card, EmptyState, IconButton, Page, SectionTitle, Stat, Tabs } from '../../components/ui'
import { formatSet, setLabels } from '../../components/workout-parts'
import { db } from '../../lib/db'
import { EQUIPMENT_LABELS, KIND_LABELS, MUSCLE_LABELS } from '../../lib/exercises-data'
import { useDoneWorkouts, useLatestBodyweight, useSettings } from '../../lib/hooks'
import { standardFor, unrankedReason } from '../../lib/rank-standards'
import { ageFromBirthYear, bodyRegion, computeRank, e1rmForLevel, exerciseHistory, personalRecords, RANKS } from '../../lib/stats'
import { cn, formatDate, formatNumber, formatShortDate } from '../../lib/utils'
import { SET_TYPE_LABELS } from '../../lib/workout'

type Metric = 'e1rm' | 'weight' | 'volume' | 'reps'

export default function ExerciseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const exercise = useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id])
  const workouts = useDoneWorkouts()
  const settings = useSettings()
  const bw = useLatestBodyweight()
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [editing, setEditing] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  const history = useMemo(() => (exercise && workouts ? exerciseHistory(exercise, workouts, bw) : []), [exercise, workouts, bw])
  const pr = useMemo(() => personalRecords(history), [history])

  if (!exercise)
    return (
      <Page back title="Exercice">
        {null}
      </Page>
    )

  const strength = exercise.kind === 'weight_reps' || exercise.kind === 'bodyweight'
  const body = { sex: settings.sex, bodyweight: bw ?? 0, heightCm: settings.heightCm, age: ageFromBirthYear(settings.birthYear) }
  const region = bodyRegion(exercise)
  const std = standardFor(exercise)
  const rank = std && bw && pr.bestE1rm ? computeRank(pr.bestE1rm.value, std.value, body, region) : undefined

  const chartData = [...history]
    .reverse()
    .map((s) => ({
      date: s.date,
      value: metric === 'e1rm' ? s.bestE1rm : metric === 'weight' ? s.maxWeight : metric === 'volume' ? s.volume : s.maxReps,
    }))
    .filter((p) => p.value > 0)

  const remove = async () => {
    if (!confirm('Supprimer cet exercice personnalisé ? Il restera visible dans les anciennes séances sous « Exercice supprimé ».')) return
    await db.exercises.delete(exercise.id)
    navigate('/exercises', { replace: true })
  }

  return (
    <Page
      back
      title={exercise.name}
      subtitle={`${MUSCLE_LABELS[exercise.muscle]} · ${EQUIPMENT_LABELS[exercise.equipment]}`}
      actions={
        <IconButton aria-label="Modifier" onClick={() => setEditing(true)}>
          <Pencil size={20} />
        </IconButton>
      }
    >
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-gold/15 px-2.5 py-1 text-gold-pale">{MUSCLE_LABELS[exercise.muscle]}</span>
        {exercise.secondary.map((m) => (
          <span key={m} className="rounded-full bg-raised px-2.5 py-1 text-ivory-dim">
            {MUSCLE_LABELS[m]}
          </span>
        ))}
        <span className="rounded-full bg-raised px-2.5 py-1 text-silver">{KIND_LABELS[exercise.kind]}</span>
      </div>
      {exercise.custom && <p className="mt-2 text-xs text-silver">Exercice personnel{exercise.guideId ? ' · consignes reprises de l’exercice d’origine' : ''}</p>}
      {exercise.notes && <p className="mt-3 text-sm text-gold-pale/80">{exercise.notes}</p>}
      <ExerciseGuide exercise={exercise} />

      {std ? (
        <Card className="mt-4">
          {rank ? (
            <div className="flex items-center gap-4">
              <RankBadge result={rank} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-silver">Ton rang</div>
                <div className="font-display text-xl font-semibold" style={{ color: rank.rank.color }}>
                  {rank.label}
                </div>
                <div className="mt-1">
                  <RankProgress result={rank} />
                </div>
                {rank.nextLabel && rank.nextLevel != null && (
                  <p className="mt-1.5 text-xs text-silver">
                    {rank.nextLabel} à {formatNumber(e1rmForLevel(rank.nextLevel, std.value, body, region), 0)} kg de 1RM estimé
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-silver">
              {bw ? 'Fais une séance avec cet exercice pour obtenir ton rang.' : 'Renseigne ton poids de corps (onglet Progrès) pour débloquer les rangs.'}
            </p>
          )}
          <details className="mt-3 text-xs text-silver">
            <summary className="-my-2 cursor-pointer py-2">Barème des rangs</summary>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {RANKS.map((r) => (
                <div key={r.key} className="flex justify-between rounded bg-ink/60 px-2 py-1">
                  <span style={{ color: r.color }}>{r.name}</span>
                  <span>{r.min === 0 ? 'départ' : bw ? `${formatNumber(e1rmForLevel(r.min, std.value, body, region), 0)} kg` : `${formatNumber(r.min * std.value, 2)}×PDC`}</span>
                </div>
              ))}
            </div>
            {std.estimated && <p className="mt-2">Barème estimé à partir d'exercices comparables (même muscle, même matériel).</p>}
          </details>
        </Card>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-4 py-3 text-xs text-silver">{unrankedReason(exercise)}</p>
      )}

      {history.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<Trophy size={36} />} title="Pas encore d'historique">
            Tes records et ta progression apparaîtront après ta première séance avec cet exercice.
          </EmptyState>
        </div>
      ) : (
        <>
          {strength && (
            <>
              <SectionTitle>Records personnels</SectionTitle>
              <Card className="grid grid-cols-2 gap-3">
                <Stat label="1RM estimé" value={pr.bestE1rm ? formatNumber(pr.bestE1rm.value) : '—'} unit="kg" />
                <Stat label="Charge max" value={pr.maxWeight ? `${formatNumber(pr.maxWeight.value)} kg × ${pr.maxWeight.reps}` : '—'} />
                <Stat label="Meilleur volume" value={pr.bestVolumeSession ? formatNumber(pr.bestVolumeSession.value, 0) : '—'} unit="kg" />
                <Stat label="Reps max" value={pr.maxReps?.value ?? '—'} />
              </Card>

              <SectionTitle>Progression</SectionTitle>
              <Card className="p-3">
                <Tabs
                  value={metric}
                  onChange={setMetric}
                  tabs={[
                    { value: 'e1rm', label: '1RM est.' },
                    { value: 'weight', label: 'Charge' },
                    { value: 'volume', label: 'Volume' },
                    { value: 'reps', label: 'Reps' },
                  ]}
                />
                <div className="mt-3">
                  <TrendChart data={chartData} unit={metric === 'reps' ? 'reps' : 'kg'} />
                </div>
              </Card>

              {Object.keys(pr.repMaxes).length > 0 && (
                <>
                  <SectionTitle>Meilleure charge par nombre de reps</SectionTitle>
                  <Card className="grid grid-cols-4 gap-2 p-3 text-center">
                    {Object.entries(pr.repMaxes).map(([reps, v]) => (
                      <div key={reps} className="rounded-lg bg-ink/60 py-2">
                        <div className="text-[11px] text-silver">{reps} RM</div>
                        <div className="font-semibold">{formatNumber(v.weight)}</div>
                      </div>
                    ))}
                  </Card>
                </>
              )}
            </>
          )}

          <SectionTitle>Historique</SectionTitle>
          <div className="space-y-2">
            {history.slice(0, 30).map((s) => {
              const labels = setLabels(s.sets.map((x) => x.type))
              return (
                <Card key={s.workoutId} className="p-3" onClick={() => navigate(`/workouts/history/${s.workoutId}`)}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{formatDate(s.date)}</span>
                    {s.bestE1rm > 0 && <span className="text-xs text-silver">1RM ~{formatNumber(s.bestE1rm)} kg</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ivory-dim">
                    {s.sets.map((set, i) => (
                      <span key={i}>
                        <span className={cn('mr-1 text-xs font-bold', SET_TYPE_LABELS[set.type].color)}>{labels[i]}</span>
                        {formatSet(set, exercise.kind)}
                      </span>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
          {history.length > 30 && <p className="mt-2 text-center text-xs text-silver">Depuis le {formatShortDate(history.at(-1)!.date)}</p>}
        </>
      )}

      <Button variant="secondary" className="mt-6 w-full" onClick={() => setDuplicating(true)}>
        <Copy size={18} /> Créer une variante (ma version de cet exercice)
      </Button>
      {exercise.custom && (
        <Button variant="danger" className="mt-2 w-full" onClick={remove}>
          <Trash2 size={18} /> Supprimer l'exercice
        </Button>
      )}
      {editing && <ExerciseForm open exercise={exercise} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {duplicating && (
        <ExerciseForm
          open
          duplicateOf={exercise}
          onClose={() => setDuplicating(false)}
          onSaved={(e) => {
            setDuplicating(false)
            navigate(`/exercises/${e.id}`, { replace: true })
          }}
        />
      )}
    </Page>
  )
}
