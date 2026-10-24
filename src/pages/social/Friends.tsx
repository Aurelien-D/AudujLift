import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardPaste, Share2, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShareRoutineSheet } from '../../components/ShareRoutine'
import { Button, Card, EmptyState, IconButton, inputClass, Page, SectionTitle } from '../../components/ui'
import { db } from '../../lib/db'
import { useSettings } from '../../lib/hooks'
import { extractShareCode } from '../../lib/share'
import type { Routine } from '../../lib/types'
import { cn, formatShortDate, normalize } from '../../lib/utils'
import { sortRoutines } from '../../lib/routine-order'

export default function Friends() {
  const navigate = useNavigate()
  const settings = useSettings()
  const friends = useLiveQuery(() => db.friends.orderBy('lastAt').reverse().toArray(), [])
  const routines = useLiveQuery(async () => sortRoutines(await db.routines.toArray()), [])
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState<Routine | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const go = (value: string) => {
    const code = extractShareCode(value)
    if (!code) return setError('Aucun lien de routine AudujLift reconnu dans ce texte.')
    setError(null)
    navigate(`/share?d=${code}`)
  }

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      setText(t)
      go(t)
    } catch {
      setError('Colle le lien dans le champ ci-dessous (appui long → Coller).')
    }
  }

  const invite = async () => {
    const url = `${location.origin}${location.pathname}`
    const msg = `${settings.name || 'Je'} t'invite sur AudujLift, mon appli de muscu et nutrition. Ouvre ce lien dans Safari puis Partager → « Sur l'écran d'accueil » :`
    if (navigator.share) await navigator.share({ title: 'AudujLift', text: msg, url }).catch(() => {})
    else await navigator.clipboard?.writeText(`${msg} ${url}`)
  }

  const fromFriend = (name: string) => (routines ?? []).filter((r) => r.sharedBy && normalize(r.sharedBy) === normalize(name))

  return (
    <Page back="/workouts" title="Amis">
      <Card>
        <h2 className="font-semibold">Importer une routine reçue</h2>
        <p className="mt-1 text-sm text-silver">Copie le lien reçu (SMS, WhatsApp…), puis colle-le ici.</p>
        <Button variant="primary" className="mt-3 w-full" onClick={paste}>
          <ClipboardPaste size={18} /> Coller le lien
        </Button>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            go(text)
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="…ou colle-le ici" className={inputClass} />
          <Button type="submit" variant="secondary" disabled={!text.trim()}>
            OK
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-warn">{error}</p>}
      </Card>

      <SectionTitle
        action={
          <Button variant="tertiary" size="sm" onClick={invite}>
            <UserPlus size={16} /> Inviter
          </Button>
        }
      >
        Mes amis
      </SectionTitle>
      {friends && friends.length === 0 ? (
        <Card>
          <EmptyState title="Pas encore d'amis">Partage une routine (menu ⋮ d'une routine → « Partager avec un ami ») ou importe celle d'un ami : il apparaîtra ici.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-2">
          {(friends ?? []).map((f) => {
            const list = fromFriend(f.name)
            return (
              <Card key={f.id} className="p-3">
                <button onClick={() => setOpen(open === f.id ? null : f.id)} className="flex w-full items-center gap-3 text-left">
                  <span className="font-display flex size-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-lg font-semibold text-gold">
                    {f.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="text-xs text-silver">
                      {f.received} reçue{f.received > 1 ? 's' : ''} · {f.sent} envoyée{f.sent > 1 ? 's' : ''} · {formatShortDate(f.lastAt)}
                    </span>
                  </span>
                </button>
                {open === f.id && (
                  <div className="animate-fade mt-3 space-y-1.5 border-t border-line/60 pt-3">
                    {list.length === 0 && <p className="text-sm text-silver">Aucune routine reçue de {f.name} dans ce profil.</p>}
                    {list.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/workouts/routine/${r.id}`)}
                        className="press flex w-full items-center justify-between rounded-lg bg-raised/50 px-3 py-2 text-left text-sm"
                      >
                        <span className="truncate">{r.name}</span>
                        <span className="text-xs text-silver">{r.exercises.length} exos</span>
                      </button>
                    ))}
                    <div className="flex justify-end">
                      <IconButton
                        aria-label={`Retirer ${f.name}`}
                        className={cn('text-silver')}
                        onClick={() => confirm(`Retirer ${f.name} de tes amis ? Ses routines restent dans tes routines.`) && void db.friends.delete(f.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <SectionTitle>Partager une de mes routines</SectionTitle>
      {routines && routines.length === 0 && <p className="text-sm text-silver">Crée d'abord une routine dans Séances.</p>}
      <div className="space-y-2">
        {(routines ?? []).map((r) => (
          <Card key={r.id} className="flex items-center gap-3 p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="text-xs text-silver">{r.exercises.length} exercices</span>
            </span>
            <Button variant="secondary" size="sm" onClick={() => setSharing(r)}>
              <Share2 size={16} /> Partager
            </Button>
          </Card>
        ))}
      </div>
      {sharing && <ShareRoutineSheet routine={sharing} onClose={() => setSharing(null)} />}
    </Page>
  )
}
