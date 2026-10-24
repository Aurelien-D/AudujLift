import { useEffect, useState } from 'react'
import { CATEGORY_LABELS, exerciseImages, LEVEL_LABELS } from '../lib/exercises-data'
import type { Exercise } from '../lib/types'
import { Card, SectionTitle } from './ui'

let guides: Promise<Record<string, string[]>> | undefined
const loadGuides = () => (guides ??= import('../data/exercise-guides.json').then((m) => m.default as Record<string, string[]>))

/** Photos de l'exercice (alternance départ / arrivée pour suggérer le mouvement) et consignes d'exécution. */
export function ExerciseGuide({ exercise }: { exercise: Exercise }) {
  const images = exerciseImages(exercise)
  const [frame, setFrame] = useState(0)
  const [failed, setFailed] = useState(false)
  const [steps, setSteps] = useState<string[] | null>(null)

  useEffect(() => {
    if (images.length < 2) return
    const t = setInterval(() => setFrame((f) => (f + 1) % 2), 1100)
    return () => clearInterval(t)
  }, [images.length])

  useEffect(() => {
    let cancelled = false
    loadGuides().then((g) => !cancelled && setSteps(g[exercise.guideId ?? exercise.id] ?? null))
    return () => {
      cancelled = true
    }
  }, [exercise.id, exercise.guideId])

  if (!images.length && !steps) return null
  return (
    <>
      {images.length > 0 && !failed && (
        <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-white">
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={i === 0 ? `${exercise.name} : position de départ` : `${exercise.name} : position d'arrivée`}
              onError={() => setFailed(true)}
              className="absolute inset-0 size-full object-contain transition-opacity duration-300"
              style={{ opacity: frame === i ? 1 : 0 }}
            />
          ))}
        </div>
      )}
      {(exercise.category || exercise.level) && (
        <div className="mt-2 flex gap-1.5 text-xs">
          {exercise.category && <span className="rounded-full bg-raised px-2.5 py-1 text-ivory-dim">{CATEGORY_LABELS[exercise.category]}</span>}
          {exercise.level && <span className="rounded-full bg-raised px-2.5 py-1 text-ivory-dim">Niveau {LEVEL_LABELS[exercise.level].toLowerCase()}</span>}
        </div>
      )}
      {steps && steps.length > 0 && (
        <>
          <SectionTitle>Comment faire</SectionTitle>
          <Card>
            <ol className="space-y-2.5 text-sm text-ivory-dim">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold-pale">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-silver">Illustrations et consignes : Free Exercise DB (domaine public).</p>
          </Card>
        </>
      )}
    </>
  )
}
