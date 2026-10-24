import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Copy, QrCode, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { useExerciseMap, useSettings } from '../lib/hooks'
import { activeProfile } from '../lib/profiles'
import { buildSharePayload, encodeShare, shareUrl } from '../lib/share'
import { recordFriend } from '../lib/friends'
import type { Routine } from '../lib/types'
import { Button, Chip, Field, inputClass, Sheet } from './ui'

/** Feuille « Partager une routine » : lien, feuille de partage du téléphone, QR code. */
export function ShareRoutineSheet({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const exMap = useExerciseMap()
  const settings = useSettings()
  const friends = useLiveQuery(() => db.friends.orderBy('lastAt').reverse().toArray(), [])
  const profile = activeProfile()
  const [from, setFrom] = useState(settings.name || (profile.name !== 'Moi' ? profile.name : ''))
  const [to, setTo] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!exMap.size) return
    let cancelled = false
    encodeShare(buildSharePayload(routine, exMap, from)).then((code) => !cancelled && setUrl(shareUrl(code)))
    return () => {
      cancelled = true
    }
  }, [routine, exMap, from])

  const text = `${from.trim() || 'Un ami'} te partage la routine « ${routine.name} » sur AudujLift`
  const noteSent = async () => {
    if (to.trim()) await recordFriend(to, 'sent')
  }

  const share = async () => {
    if (!url) return
    await noteSent()
    if (navigator.share) {
      try {
        await navigator.share({ title: routine.name, text, url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    await copy()
  }
  const copy = async () => {
    if (!url) return
    await noteSent()
    try {
      await navigator.clipboard.writeText(`${text} : ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copie ce lien :', url)
    }
  }
  const showQr = async () => {
    if (!url) return
    const { default: qrcode } = await import('qrcode-generator')
    const q = qrcode(0, 'L')
    q.addData(url)
    q.make()
    setQr(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }))
  }

  return (
    <Sheet open onClose={onClose} title={`Partager « ${routine.name} »`}>
      <div className="space-y-3 text-sm">
        <p className="text-silver">
          Ton ami reçoit un lien : il l'ouvre et ajoute la routine en un geste. Les exercices et le nombre de séries/reps sont partagés,{' '}
          <b className="text-ivory">pas tes charges</b>.
        </p>
        <Field label="Ton prénom (affiché chez ton ami)">
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Ton prénom" className={inputClass} />
        </Field>
        <Field label="Pour qui ? (facultatif)">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Prénom de ton ami" className={inputClass} />
        </Field>
        {friends && friends.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {friends.slice(0, 8).map((f) => (
              <Chip key={f.id} active={to === f.name} onClick={() => setTo(to === f.name ? '' : f.name)}>
                {f.name}
              </Chip>
            ))}
          </div>
        )}
        <Button variant="primary" size="lg" className="w-full" disabled={!url} onClick={share}>
          <Share2 size={18} /> Envoyer (SMS, WhatsApp, AirDrop…)
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={!url} onClick={copy}>
            {copied ? <Check size={18} className="text-gold" /> : <Copy size={18} />} {copied ? 'Copié' : 'Copier le lien'}
          </Button>
          <Button variant="secondary" disabled={!url} onClick={showQr}>
            <QrCode size={18} /> QR code
          </Button>
        </div>
        {qr && (
          <div className="animate-fade rounded-xl bg-white p-3">
            <div className="mx-auto w-full max-w-64 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-2 text-center text-xs text-black/70">À scanner avec l'appareil photo de ton ami</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}
