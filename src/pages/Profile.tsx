import { Calculator, Download, Info, Smartphone, Upload, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ProfileAvatar, ProfileSwitcher } from '../components/ProfileSwitcher'
import { Button, Card, Field, inputClass, NumberInput, Page, SectionTitle, Select, Tabs, Toggle } from '../components/ui'
import { REST_OPTIONS } from '../components/workout-parts'
import { downloadBlob, exportBackup, importBackup } from '../lib/backup'
import { db, saveSettings } from '../lib/db'
import { useLatestBodyweight, useSettings } from '../lib/hooks'
import { ACTIVITY_LABELS, GOAL_LABELS, suggestGoals } from '../lib/nutrition'
import { forgetOffAccount, offAccount } from '../lib/off-contribute'
import { aiKey, aiUsage, forgetAiKey, maskKey } from '../lib/plate-ai'
import { AiKeySetup } from './nutrition/PlatePhoto'
import { activeProfile, listProfiles, renameProfile } from '../lib/profiles'
import type { Activity, Goal, Settings } from '../lib/types'
import { formatClock, formatShortDate, toISODate, uid } from '../lib/utils'

export default function Profile() {
  const stored = useSettings()
  const bw = useLatestBodyweight()
  const [s, setS] = useState<Settings>(stored)
  const [weight, setWeight] = useState<number | undefined>(bw)
  const [saved, setSaved] = useState(false)
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestGoals> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [switcher, setSwitcher] = useState(false)
  const [offUser, setOffUser] = useState(() => offAccount()?.userId)
  const [aiKeyValue, setAiKeyValue] = useState(() => aiKey())
  const usage = aiUsage()
  const profile = activeProfile()

  useEffect(() => {
    // Un nouveau profil reprend le prénom saisi à sa création
    setS({ ...stored, name: stored.name || (profile.name !== 'Moi' ? profile.name : '') })
  }, [stored, profile.name])
  useEffect(() => {
    setWeight((w) => w ?? bw)
  }, [bw])

  const patch = (p: Partial<Settings>) => {
    setS({ ...s, ...p })
    setSaved(false)
  }
  const patchGoals = (p: Partial<Settings['goals']>) => patch({ goals: { ...s.goals, ...p } })
  const patchRest = (p: Partial<Settings['restGoals']>) => patch({ restGoals: { ...s.restGoals, ...p } })

  const compute = () => {
    if (!weight) return alert('Renseigne ton poids pour calculer tes besoins.')
    setSuggestion(suggestGoals({ sex: s.sex, weightKg: weight, heightCm: s.heightCm, age: new Date().getFullYear() - s.birthYear, activity: s.activity, goal: s.goal }))
  }

  const save = async () => {
    // Ces deux champs sont gérés ailleurs (export, suggestion de calories) : on ne les écrase pas
    const { lastBackupAt: _b, tdeeSnoozeUntil: _t, ...edited } = s
    await saveSettings({ ...edited, onboarded: true })
    if (s.name.trim()) renameProfile(profile.id, s.name)
    if (weight && weight !== bw) {
      const today = toISODate()
      const existing = await db.bodyweights.where('date').equals(today).first()
      await db.bodyweights.put({ id: existing?.id ?? uid(), date: today, weight })
    }
    setSaved(true)
  }

  const macroKcal = s.goals.protein * 4 + s.goals.carbs * 4 + s.goals.fat * 9
  const pct = (k: number) => (macroKcal ? Math.round((k / macroKcal) * 100) : 0)

  return (
    <Page
      title="Profil & réglages"
      actions={
        <Button variant="primary" size="sm" onClick={save}>
          {saved ? 'Enregistré ✓' : 'Enregistrer'}
        </Button>
      }
    >
      <Card className="flex items-center gap-3" onClick={() => setSwitcher(true)}>
        <ProfileAvatar profile={profile} />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-silver">Profil actif</div>
          <div className="truncate font-bold">{s.name || profile.name}</div>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-medium text-gold">
          <Users size={18} /> {listProfiles().length > 1 ? 'Changer' : 'Ajouter un profil'}
        </span>
      </Card>
      <ProfileSwitcher open={switcher} onClose={() => setSwitcher(false)} />

      <SectionTitle>Moi</SectionTitle>
      <Card className="space-y-3">
        <Field label="Prénom">
          <input value={s.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ton prénom" className={inputClass} />
        </Field>
        <Field label="Sexe">
          <Tabs
            value={s.sex}
            onChange={(sex) => patch({ sex })}
            tabs={[
              { value: 'male', label: 'Homme' },
              { value: 'female', label: 'Femme' },
            ]}
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Année de naissance">
            <NumberInput value={s.birthYear} onChange={(v) => v && patch({ birthYear: v })} decimals={false} />
          </Field>
          <Field label="Taille (cm)">
            <NumberInput value={s.heightCm} onChange={(v) => v && patch({ heightCm: v })} decimals={false} />
          </Field>
          <Field label="Poids (kg)">
            <NumberInput value={weight} onChange={setWeight} />
          </Field>
        </div>
        <Field label="Niveau d'activité" hint={ACTIVITY_LABELS[s.activity].hint}>
          <Select
            value={s.activity}
            onChange={(activity) => patch({ activity })}
            options={Object.entries(ACTIVITY_LABELS).map(([value, a]) => ({ value: value as Activity, label: a.label }))}
          />
        </Field>
        <Field label="Objectif">
          <Select value={s.goal} onChange={(goal) => patch({ goal })} options={Object.entries(GOAL_LABELS).map(([value, g]) => ({ value: value as Goal, label: g.label }))} />
        </Field>
        <Button variant="outline" className="w-full" onClick={compute}>
          <Calculator size={18} className="text-gold" /> Calculer mes besoins
        </Button>
        {suggestion && (
          <div className="animate-pop rounded-xl bg-gold/10 p-3 text-sm">
            <p className="text-ivory-dim">
              Métabolisme de base : <b>{suggestion.bmr} kcal</b> · Dépense journalière : <b>{suggestion.tdee} kcal</b>
            </p>
            <p className="mt-1 font-semibold text-gold-pale">
              Proposition : {suggestion.kcal} kcal · P {suggestion.protein} g · G {suggestion.carbs} g · L {suggestion.fat} g
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                patchGoals({ kcal: suggestion.kcal, protein: suggestion.protein, carbs: suggestion.carbs, fat: suggestion.fat })
                setSuggestion(null)
              }}
            >
              Appliquer ces objectifs
            </Button>
          </div>
        )}
      </Card>

      <SectionTitle>Objectifs nutrition (par jour)</SectionTitle>
      <Card className="space-y-3">
        <Toggle
          checked={s.splitGoals}
          onChange={(splitGoals) => patch({ splitGoals })}
          label="Objectifs différents les jours de repos"
          hint="Les objectifs ci-dessous valent alors pour les jours d'entraînement."
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Calories (kcal)" hint={macroKcal && Math.abs(macroKcal - s.goals.kcal) > 50 ? `Les macros font ${Math.round(macroKcal)} kcal` : undefined}>
            <NumberInput value={s.goals.kcal} onChange={(v) => patchGoals({ kcal: v ?? 0 })} decimals={false} />
          </Field>
          <Field label="Eau (ml)">
            <NumberInput value={s.goals.waterMl} onChange={(v) => patchGoals({ waterMl: v ?? 0 })} decimals={false} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label={`Protéines · ${pct(s.goals.protein * 4)} %`}>
            <NumberInput value={s.goals.protein} onChange={(v) => patchGoals({ protein: v ?? 0 })} decimals={false} />
          </Field>
          <Field label={`Glucides · ${pct(s.goals.carbs * 4)} %`}>
            <NumberInput value={s.goals.carbs} onChange={(v) => patchGoals({ carbs: v ?? 0 })} decimals={false} />
          </Field>
          <Field label={`Lipides · ${pct(s.goals.fat * 9)} %`}>
            <NumberInput value={s.goals.fat} onChange={(v) => patchGoals({ fat: v ?? 0 })} decimals={false} />
          </Field>
        </div>
        {s.splitGoals && (
          <div className="animate-fade space-y-2 border-t border-line/60 pt-3">
            <div className="label">Jours de repos</div>
            <div className="grid grid-cols-4 gap-2">
              <Field label="Kcal">
                <NumberInput value={s.restGoals.kcal} onChange={(v) => patchRest({ kcal: v ?? 0 })} decimals={false} />
              </Field>
              <Field label="Prot.">
                <NumberInput value={s.restGoals.protein} onChange={(v) => patchRest({ protein: v ?? 0 })} decimals={false} />
              </Field>
              <Field label="Gluc.">
                <NumberInput value={s.restGoals.carbs} onChange={(v) => patchRest({ carbs: v ?? 0 })} decimals={false} />
              </Field>
              <Field label="Lip.">
                <NumberInput value={s.restGoals.fat} onChange={(v) => patchRest({ fat: v ?? 0 })} decimals={false} />
              </Field>
            </div>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => {
                const kcal = Math.round((s.goals.kcal * 0.85) / 10) * 10
                patchRest({ kcal, protein: s.goals.protein, fat: s.goals.fat, carbs: Math.max(0, Math.round((kcal - s.goals.protein * 4 - s.goals.fat * 9) / 4)) })
              }}
            >
              Proposer : −15 % sur les glucides
            </Button>
          </div>
        )}
      </Card>

      <SectionTitle>Entraînement</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Repos par défaut">
            <Select
              value={String(s.defaultRestSec)}
              onChange={(v) => patch({ defaultRestSec: Number(v) })}
              options={REST_OPTIONS.map((r) => ({ value: String(r), label: r ? formatClock(r) : 'Aucun' }))}
            />
          </Field>
          <Field label="Objectif séances / semaine">
            <NumberInput value={s.weeklyWorkoutGoal} onChange={(v) => v && patch({ weeklyWorkoutGoal: Math.min(7, v) })} decimals={false} />
          </Field>
        </div>
        <Field label="Poids de la barre (kg)">
          <NumberInput value={s.barWeight} onChange={(v) => patch({ barWeight: v ?? 20 })} />
        </Field>
        <div className="divide-y divide-line/50 border-t border-line/60 pt-1">
          <Toggle
            checked={s.autoProgression}
            onChange={(autoProgression) => patch({ autoProgression })}
            label="Progression automatique"
            hint="+2,5 kg quand toutes les reps visées ont été réussies."
          />
          <Toggle checked={s.askRpe} onChange={(askRpe) => patch({ askRpe })} label="Noter l'effort (RPE)" hint="Propose une note de 6 à 10 après chaque série (facultatif)." />
          <Toggle
            checked={s.keepAwake}
            onChange={(keepAwake) => patch({ keepAwake })}
            label="Écran toujours allumé en séance"
            hint="Évite de déverrouiller le téléphone entre les séries."
          />
        </div>
      </Card>

      <SectionTitle>Analyse d'assiette (IA)</SectionTitle>
      <Card>
        {aiKeyValue ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-silver">
                Clé Anthropic : <span className="text-ivory-dim">{maskKey(aiKeyValue)}</span>
              </span>
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => {
                  if (!confirm('Effacer la clé de ce téléphone ?')) return
                  forgetAiKey()
                  setAiKeyValue(null)
                }}
              >
                Effacer
              </Button>
            </div>
            <p className="text-xs text-silver">
              Ce mois-ci : {usage.photos} photo{usage.photos > 1 ? 's' : ''} analysée{usage.photos > 1 ? 's' : ''} · environ {usage.costUsd.toFixed(2).replace('.', ',')} $
              (estimation ; le montant exact est dans la console Anthropic).
            </p>
          </div>
        ) : (
          <AiKeySetup onSaved={() => setAiKeyValue(aiKey())} />
        )}
      </Card>

      <SectionTitle>Mes données</SectionTitle>
      <Card className="space-y-2">
        <p className="text-sm text-silver">
          Tes données restent sur cet appareil (aucun compte, aucun serveur). Pense à faire une sauvegarde de temps en temps, ou pour passer sur un autre téléphone.
        </p>
        {offUser && (
          <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-2 text-xs text-silver">
            <span>
              Compte Open Food Facts : <span className="text-ivory-dim">{offUser}</span>
            </span>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => {
                forgetOffAccount()
                setOffUser(undefined)
              }}
            >
              Oublier
            </Button>
          </div>
        )}
        <p className="text-xs text-silver-dim">{stored.lastBackupAt ? `Dernière sauvegarde : ${formatShortDate(stored.lastBackupAt)}` : 'Aucune sauvegarde pour le moment.'}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              downloadBlob(await exportBackup(), `audujlift-${toISODate()}.json`)
              await saveSettings({ lastBackupAt: Date.now() })
            }}
          >
            <Download size={18} /> Exporter
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> Importer
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f || !confirm('Importer cette sauvegarde ? Les données actuelles seront remplacées.')) return
            try {
              await importBackup(f)
              alert('Sauvegarde restaurée ✓')
            } catch (err) {
              alert((err as Error).message)
            }
          }}
        />
      </Card>

      <SectionTitle>À propos</SectionTitle>
      <Card className="space-y-3 text-sm text-silver">
        <p className="flex gap-2">
          <Smartphone size={18} className="shrink-0 text-gold" />
          <span>
            Installe AudujLift sur ton écran d'accueil : sur iPhone, <b>Partager → Sur l'écran d'accueil</b> ; sur Android, menu <b>⋮ → Installer l'application</b>. Elle fonctionne
            aussi hors connexion.
          </span>
        </p>
        <p className="flex gap-2">
          <Info size={18} className="shrink-0 text-gold" />
          <span>
            Données alimentaires fournies par{' '}
            <a href="https://fr.openfoodfacts.org" target="_blank" rel="noreferrer" className="text-gold underline">
              Open Food Facts
            </a>{' '}
            (licence ODbL), la base collaborative et libre des produits alimentaires. Aliments génériques issus de la{' '}
            <a href="https://ciqual.anses.fr" target="_blank" rel="noreferrer" className="text-gold underline">
              table Ciqual 2025
            </a>{' '}
            de l'ANSES (licence CC-BY 4.0). Exercices, photos et consignes :{' '}
            <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer" className="text-gold underline">
              Free Exercise DB
            </a>{' '}
            (domaine public).
          </span>
        </p>
      </Card>
    </Page>
  )
}
