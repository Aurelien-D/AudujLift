import { ChevronsUp, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useDoneWorkouts, useExercises, useRankBody } from '../lib/hooks'
import { rankChanges, rankSnapshot, standardFor, type RankChange } from '../lib/rank-standards'
import { bodyRegion, e1rmForLevel, type BodyProfile, type RankResult } from '../lib/stats'
import type { Workout } from '../lib/types'
import { cn, formatNumber } from '../lib/utils'
import { RankBadge, RankProgress } from './RankBadge'
import { Button } from './ui'

const STEP_MS = 700

function ChangeRow({ c, body }: { c: RankChange; body: BodyProfile }) {
  const { now, before, change, tierUp } = c
  const missing = now.rank.nextLevel != null ? e1rmForLevel(now.rank.nextLevel, now.standard, body, bodyRegion(now.ex)) - now.e1rm : 0
  return (
    <div
      className={cn(
        'animate-rise flex items-center gap-3 rounded-2xl border bg-raised/60 p-3',
        change === 'up' ? 'border-gold/50 shadow-[0_0_28px_-8px] shadow-gold/40' : 'border-line/70',
      )}
    >
      <div className="animate-rank">
        <RankBadge result={now.rank} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-ivory">{now.ex.name}</div>
          {change === 'up' && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">
              <ChevronsUp size={13} /> {tierUp ? 'Nouveau rang' : 'Promotion'}
            </span>
          )}
          {change === 'new' && <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-[11px] text-ivory-dim">1er classement</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm">
          {change === 'up' && before && (
            <>
              <span style={{ color: before.rank.color }} className="opacity-70">
                {before.label}
              </span>
              <span className="text-silver">→</span>
            </>
          )}
          <span className="font-semibold" style={{ color: now.rank.rank.color }}>
            {now.rank.label}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink">
          <div className="h-full rounded-full" style={{ width: `${now.rank.stepProgress * 100}%`, background: now.rank.rank.color }} />
        </div>
        {now.rank.nextLabel && missing > 0 && (
          <p className="mt-1 text-[11px] text-silver">
            Encore ~{formatNumber(Math.max(0.5, missing), missing < 10 ? 1 : 0)} kg de 1RM estimé pour {now.rank.nextLabel}
            {now.estimated && ' · barème estimé'}
          </p>
        )}
      </div>
    </div>
  )
}

/** Fenêtre de fin de séance : les rangs des exercices apparaissent un par un, puis le rang global. */
export function RankReveal({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const navigate = useNavigate()
  const exercises = useExercises()
  const all = useDoneWorkouts()
  const body = useRankBody()
  const [shown, setShown] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  const data = useMemo(() => {
    if (!exercises || !all || !body) return undefined
    const withThis = all.some((w) => w.id === workout.id) ? all : [...all, workout]
    const before = rankSnapshot(
      exercises,
      withThis.filter((w) => w.id !== workout.id),
      body,
    )
    const after = rankSnapshot(exercises, withThis, body)
    return { changes: rankChanges(workout, before, after), overallBefore: before.overall, overallAfter: after.overall }
  }, [exercises, all, body, workout])

  // Exercices de la séance qui pourraient être classés (pour le message sans pesée)
  const rankable = useMemo(() => {
    const ids = new Set(workout.exercises.map((e) => e.exerciseId))
    return (exercises ?? []).filter((e) => ids.has(e.id) && standardFor(e)).length
  }, [exercises, workout])

  const total = data ? data.changes.length + 1 : 0
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (!data || shown >= total) return
    const t = setTimeout(
      () => {
        const c = data.changes[shown]
        if (c?.change === 'up') navigator.vibrate?.(c.tierUp ? [30, 60, 30] : 20)
        setShown((n) => n + 1)
      },
      reduced ? 0 : shown === 0 ? 350 : STEP_MS,
    )
    return () => clearTimeout(t)
  }, [data, shown, total, reduced])

  // Le dernier élément révélé reste visible
  useEffect(() => {
    const el = list.current
    if (el && shown > 0) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [shown, reduced])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Chargement, ou rien à montrer (aucun exercice classable dans la séance)
  if (!exercises || !all || body === undefined) return null
  if (body ? !data?.changes.length : rankable === 0) return null

  const ups = data?.changes.filter((c) => c.change === 'up').length ?? 0
  const overallUp = (o?: RankResult, n?: RankResult) => !!o && !!n && n.score > o.score && n.label !== o.label
  const done = !!data && shown >= total

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-label="Tes rangs">
      <div className="animate-fade absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => (done ? onClose() : setShown(total))} />
      <div className="animate-sheet pb-safe relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[28px] border-t border-gold/30 bg-surface sm:rounded-[28px] sm:border">
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2 text-gold">
            <Sparkles size={18} />
            <span className="text-xs font-semibold tracking-[0.18em] uppercase">Tes rangs</span>
          </div>
          <h2 className="font-display mt-1 text-xl font-semibold">{!body ? 'Débloque tes rangs' : ups > 0 && done ? `${ups} promotion${ups > 1 ? 's' : ''} !` : workout.name}</h2>
        </div>

        <div ref={list} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4" onClick={() => !done && setShown(total)}>
          {!body ? (
            <p className="text-sm text-silver">
              Ta séance compte {rankable} exercice{rankable > 1 ? 's' : ''} classable{rankable > 1 ? 's' : ''}, mais il faut ton poids de corps pour calculer tes rangs. Ajoute une
              pesée dans Progrès → Corps.
            </p>
          ) : (
            <>
              {data?.changes.slice(0, shown).map((c) => (
                <ChangeRow key={c.now.ex.id} c={c} body={body} />
              ))}
              {data && shown > data.changes.length && data.overallAfter && (
                <div
                  className={cn(
                    'animate-record mt-3 flex items-center gap-4 rounded-2xl border p-4',
                    overallUp(data.overallBefore, data.overallAfter) ? 'border-gold/50' : 'border-line/70',
                  )}
                >
                  <div className="animate-rank">
                    <RankBadge result={data.overallAfter} size="lg" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-silver">Rang global</div>
                    <div className="font-display text-lg font-semibold">
                      {overallUp(data.overallBefore, data.overallAfter) && (
                        <>
                          <span style={{ color: data.overallBefore!.rank.color }} className="opacity-70">
                            {data.overallBefore!.label}
                          </span>{' '}
                          <span className="text-silver">→</span>{' '}
                        </>
                      )}
                      <span style={{ color: data.overallAfter.rank.color }}>{data.overallAfter.label}</span>
                    </div>
                    <div className="mt-1">
                      <RankProgress result={data.overallAfter} />
                    </div>
                  </div>
                </div>
              )}
              {!done && <p className="pt-1 text-center text-xs text-silver-dim">Touche pour tout afficher</p>}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-line/60 px-5 pt-3 pb-4">
          <Button variant="secondary" onClick={() => (onClose(), navigate(body ? '/progress?tab=ranks' : '/progress'))}>
            {body ? 'Tous mes rangs' : 'Ajouter une pesée'}
          </Button>
          <Button variant="primary" onClick={onClose}>
            Continuer
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
