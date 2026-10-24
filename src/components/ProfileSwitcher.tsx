import { Check, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { activeProfileId, createProfile, deleteProfile, listProfiles, switchProfile, type Profile } from '../lib/profiles'
import { cn } from '../lib/utils'
import { Button, IconButton, inputClass, Sheet } from './ui'

export function ProfileAvatar({ profile, size = 'md' }: { profile: Profile; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full font-black text-zinc-950', size === 'sm' ? 'size-9 text-sm' : 'size-11 text-base')}
      style={{ background: profile.color }}
    >
      {profile.name.charAt(0).toUpperCase()}
    </span>
  )
}

export function ProfileSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profiles, setProfiles] = useState(listProfiles)
  const [name, setName] = useState('')
  const active = activeProfileId()

  const add = () => {
    if (!name.trim()) return
    const p = createProfile(name)
    switchProfile(p.id)
  }
  const remove = async (p: Profile) => {
    if (!confirm(`Supprimer le profil « ${p.name} » et TOUTES ses données (séances, journal, poids) ? C'est définitif.`)) return
    await deleteProfile(p.id)
    setProfiles(listProfiles())
  }

  return (
    <Sheet open={open} onClose={onClose} title="Profils">
      <p className="mb-3 text-sm text-zinc-400">Chaque profil a ses propres séances, routines, journal alimentaire, poids et objectifs.</p>
      <div className="space-y-1">
        {profiles.map((p) => (
          <div key={p.id} className={cn('flex items-center gap-3 rounded-xl px-2 py-2', p.id === active && 'bg-zinc-800/70')}>
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => (p.id === active ? onClose() : switchProfile(p.id))}>
              <ProfileAvatar profile={p} />
              <span className="truncate font-semibold">{p.name}</span>
              {p.id === active && <Check size={18} className="text-lime-400" />}
            </button>
            {p.id !== active && (
              <IconButton aria-label={`Supprimer ${p.name}`} onClick={() => remove(p)} className="text-zinc-400">
                <Trash2 size={18} />
              </IconButton>
            )}
          </div>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom du nouveau profil" className={inputClass} />
        <Button variant="primary" disabled={!name.trim()} className="shrink-0">
          <Plus size={18} /> Ajouter
        </Button>
      </form>
    </Sheet>
  )
}
