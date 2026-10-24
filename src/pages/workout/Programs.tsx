import { CalendarDays, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Page } from '../../components/ui'
import { db, getSettings, saveSettings } from '../../lib/db'
import { useExerciseMap } from '../../lib/hooks'
import { PROGRAMS, templateToExercises, type ProgramTemplate } from '../../lib/templates'
import { uid } from '../../lib/utils'

export default function Programs() {
  const navigate = useNavigate()
  const exMap = useExerciseMap()

  const importProgram = async (p: ProgramTemplate) => {
    const now = Date.now()
    const settings = await getSettings()
    await db.routines.bulkAdd(
      p.routines.map((r, i) => ({
        id: uid(),
        name: r.name,
        folder: p.name,
        exercises: templateToExercises(r.lines, (id) => exMap.get(id)?.kind),
        createdAt: now + i,
        updatedAt: now + p.routines.length - i,
      })),
    )
    if (settings.weeklyWorkoutGoal < Math.min(p.daysPerWeek, 4)) await saveSettings({ weeklyWorkoutGoal: Math.min(p.daysPerWeek, 4) })
    navigate('/workouts')
  }

  return (
    <Page title="Programmes" back="/workouts">
      <p className="mb-4 text-sm text-silver">Importe un programme : ses séances sont ajoutées à tes routines et restent entièrement modifiables.</p>
      <div className="space-y-4">
        {PROGRAMS.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="text-xs text-gold">{p.level}</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs text-ivory-dim">
                <CalendarDays size={14} /> {p.daysPerWeek}×/sem
              </span>
            </div>
            <p className="mt-2 text-sm text-silver">{p.description}</p>
            <ul className="mt-3 space-y-2">
              {p.routines.map((r) => (
                <li key={r.name} className="rounded-xl bg-ink/60 px-3 py-2">
                  <div className="text-sm font-semibold">{r.name}</div>
                  <div className="text-xs text-silver">{r.lines.map(([id, sets, reps]) => `${exMap.get(id)?.name ?? id} ${sets}×${reps || '45 s'}`).join(' · ')}</div>
                </li>
              ))}
            </ul>
            <Button variant="primary" className="mt-3 w-full" onClick={() => importProgram(p)}>
              <Download size={18} /> Importer ce programme
            </Button>
          </Card>
        ))}
      </div>
    </Page>
  )
}
