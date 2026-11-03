import { Check, Copy, ExternalLink, Share2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { assistantUrl, workoutsToMarkdown, type ExportProfile } from '../lib/ai-export'
import { useDoneWorkouts, useExerciseMap, useLatestBodyweight, useSettings } from '../lib/hooks'
import type { Workout } from '../lib/types'
import { formatNumber, toISODate } from '../lib/utils'
import { Button, Chip, Sheet, Toggle } from './ui'

type Period = 'one' | 'last' | '4w' | '12w' | 'all'
const DAY = 86_400_000
const PERIODS: { value: Period; label: string }[] = [
  { value: 'last', label: 'Dernière séance' },
  { value: '4w', label: '4 semaines' },
  { value: '12w', label: '3 mois' },
  { value: 'all', label: 'Tout' },
]

/** Feuille « Analyser avec une IA » : export texte des séances, à copier, partager ou ouvrir dans Claude / ChatGPT. */
export function AiExportSheet({ workout, onClose }: { workout?: Workout; onClose: () => void }) {
  const all = useDoneWorkouts()
  const exMap = useExerciseMap()
  const settings = useSettings()
  const bw = useLatestBodyweight()
  const [period, setPeriod] = useState<Period>(workout ? 'one' : '4w')
  const [withPrompt, setWithPrompt] = useState(true)
  const [done, setDone] = useState<string | null>(null)
  // Date de référence lue une fois à l'ouverture (périodes « 4 semaines », « 3 mois », âge)
  const [now] = useState(() => Date.now())

  const { text, count, label } = useMemo(() => {
    const list = all ?? []
    const sel =
      period === 'one' && workout
        ? [workout]
        : period === 'last'
          ? list.slice(0, 1)
          : period === '4w'
            ? list.filter((w) => w.startedAt >= now - 28 * DAY)
            : period === '12w'
              ? list.filter((w) => w.startedAt >= now - 84 * DAY)
              : list
    const label = period === 'one' || period === 'last' ? 'une séance' : period === '4w' ? '4 dernières semaines' : period === '12w' ? '3 derniers mois' : 'tout mon historique'
    const profile: ExportProfile = {
      sex: settings.sex,
      age: settings.birthYear > 1900 ? new Date(now).getFullYear() - settings.birthYear : undefined,
      heightCm: settings.heightCm || undefined,
      bodyweight: bw,
      goal: settings.goal,
      weeklyGoal: settings.weeklyWorkoutGoal,
    }
    const periodDays = period === '4w' ? 28 : period === '12w' ? 84 : undefined
    return { text: workoutsToMarkdown({ workouts: sel, exMap, profile, periodLabel: label, periodDays, withPrompt, now }), count: sel.length, label }
  }, [all, exMap, settings, bw, period, workout, withPrompt, now])

  const flash = (msg: string) => {
    setDone(msg)
    setTimeout(() => setDone(null), 4000)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      flash('Copié : colle-le dans Claude, ChatGPT ou l’assistant de ton choix.')
    } catch {
      flash('Copie impossible sur ce navigateur : utilise « Partager ».')
    }
  }
  const share = async () => {
    const file = new File([text], `seances-audujlift-${toISODate()}.md`, { type: 'text/markdown' })
    try {
      if (navigator.canShare?.({ files: [file] })) return void (await navigator.share({ files: [file], title: 'Mes séances' }))
      if (navigator.share) return void (await navigator.share({ title: 'Mes séances', text }))
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    // Ordinateur sans partage : téléchargement du fichier
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const open = (target: 'claude' | 'chatgpt') => {
    const { url, prefilled } = assistantUrl(target, text)
    // Le texte est aussi copié : utile s'il est trop long pour l'adresse, ou si l'appli s'ouvre sans le reprendre
    void navigator.clipboard?.writeText(text).catch(() => {})
    window.open(url, '_blank', 'noopener')
    flash(prefilled ? 'Conversation ouverte avec tes séances.' : 'Export trop long pour l’adresse : il est copié, colle-le dans la conversation.')
  }

  return (
    <Sheet open onClose={onClose} title="Analyser avec une IA">
      <div className="space-y-3">
        <p className="text-sm text-silver">
          Tes séances sont mises en texte (exercices, séries, charges, RPE, 1RM estimé, résumé par muscle) avec ton profil, pour une analyse par Claude, ChatGPT ou un autre
          assistant. Rien n'est envoyé tant que tu ne partages pas.
        </p>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {workout && (
            <Chip active={period === 'one'} onClick={() => setPeriod('one')}>
              Cette séance
            </Chip>
          )}
          {PERIODS.map((p) => (
            <Chip key={p.value} active={period === p.value} onClick={() => setPeriod(p.value)}>
              {p.label}
            </Chip>
          ))}
        </div>
        <Toggle
          checked={withPrompt}
          onChange={setWithPrompt}
          label="Ajouter la consigne d'analyse"
          hint="Demande une analyse façon coach : progression, équilibre, récupération, ajustements."
        />
        <details className="rounded-xl border border-line/70 bg-ink/60 text-xs">
          <summary className="cursor-pointer px-3 py-2.5 text-silver">
            Aperçu · {count} séance{count > 1 ? 's' : ''} ({label}) · {formatNumber(text.length, 0)} caractères
          </summary>
          <pre className="max-h-64 overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ivory-dim">{text}</pre>
        </details>
        {count === 0 ? (
          <p className="text-sm text-silver">Aucune séance sur cette période.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => open('claude')}>
                <ExternalLink size={18} /> Claude
              </Button>
              <Button variant="primary" onClick={() => open('chatgpt')}>
                <ExternalLink size={18} /> ChatGPT
              </Button>
              <Button variant="secondary" onClick={copy}>
                {done?.startsWith('Copié') ? <Check size={18} /> : <Copy size={18} />} Copier
              </Button>
              <Button variant="secondary" onClick={share}>
                <Share2 size={18} /> Partager
              </Button>
            </div>
            {done && <p className="text-xs text-silver">{done}</p>}
          </>
        )}
      </div>
    </Sheet>
  )
}
