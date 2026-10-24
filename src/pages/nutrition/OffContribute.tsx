import { CheckCircle2, ExternalLink, Globe, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Field, inputClass, Sheet, Toggle } from '../../components/ui'
import { db } from '../../lib/db'
import { contributeToOff, isValidBarcode, offAccount, offProductUrl, saveOffAccount } from '../../lib/off-contribute'
import type { Food } from '../../lib/types'
import { formatNumber, formatShortDate } from '../../lib/utils'

/** Carte « Partager sur Open Food Facts » pour un produit créé par l'utilisateur. */
export function OffContribute({ food }: { food: Food }) {
  const [open, setOpen] = useState(false)
  if (food.source !== 'custom' || !isValidBarcode(food.barcode)) return null

  const sheet = open && <ContributeSheet food={food} onClose={() => setOpen(false)} />

  if (food.offSubmittedAt)
    return (
      <>
        <Card className="mt-3 flex items-center gap-3 border-gold/25">
          <CheckCircle2 size={20} className="shrink-0 text-gold" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium text-ivory">Partagé sur Open Food Facts</div>
            <div className="text-xs text-silver">Le {formatShortDate(food.offSubmittedAt)} · merci pour la base collaborative</div>
          </div>
          <a href={offProductUrl(food.barcode!)} target="_blank" rel="noreferrer" className="press flex items-center gap-1 text-sm text-gold">
            Voir <ExternalLink size={14} />
          </a>
        </Card>
        {sheet}
      </>
    )

  return (
    <>
      <Card className="mt-3">
        <div className="flex items-start gap-3">
          <Globe size={20} className="mt-0.5 shrink-0 text-gold" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium text-ivory">Absent d'Open Food Facts</div>
            <p className="mt-0.5 text-silver">Partage-le : il sera trouvé au prochain scan, par toi comme par tous les utilisateurs.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)}>
              Partager sur Open Food Facts
            </Button>
          </div>
        </div>
      </Card>
      {sheet}
    </>
  )
}

function ContributeSheet({ food, onClose }: { food: Food; onClose: () => void }) {
  const saved = offAccount()
  const [userId, setUserId] = useState(saved?.userId ?? '')
  const [password, setPassword] = useState(saved?.password ?? '')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const photos = (food.photos ?? []).filter(Boolean).length

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const account = { userId: userId.trim(), password }
      const res = await contributeToOff(food, account)
      if (remember) saveOffAccount(account)
      if (res.status === 'exists') {
        setDone('Ce produit vient d’être ajouté à Open Food Facts par quelqu’un d’autre : rien à envoyer.')
      } else {
        await db.foods.update(food.id, { offSubmittedAt: Date.now() })
        setDone(
          res.photoErrors
            ? `Produit envoyé. ${res.photoErrors} photo${res.photoErrors > 1 ? 's' : ''} n'a pas pu partir : tu pourras l'ajouter depuis le site.`
            : `Produit envoyé${res.photos ? ` avec ${res.photos} photo${res.photos > 1 ? 's' : ''}` : ''}. Merci !`,
        )
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title="Partager sur Open Food Facts">
      {done ? (
        <div className="space-y-4 text-sm">
          <p className="flex items-start gap-2 text-ivory">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-gold" /> {done}
          </p>
          <Button variant="primary" size="lg" className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-line/70 bg-ink/50 p-3">
            <div className="font-medium text-ivory">{food.name}</div>
            <div className="text-xs text-silver">
              {food.brand ? `${food.brand} · ` : ''}EAN {food.barcode}
              {photos ? ` · ${photos} photo${photos > 1 ? 's' : ''}` : ' · sans photo'}
            </div>
            <div className="mt-1.5 text-xs text-ivory-dim">
              Pour 100 {food.unit} : {Math.round(food.per100.kcal)} kcal · prot. {formatNumber(food.per100.protein)} g · gluc. {formatNumber(food.per100.carbs)} g · lip.{' '}
              {formatNumber(food.per100.fat)} g
            </div>
            <div className="mt-1 text-[11px] text-silver-dim">Vérifie ces valeurs : elles seront visibles par tous.</div>
          </div>
          {!saved && (
            <p className="text-silver">
              Il faut un compte Open Food Facts (gratuit).{' '}
              <a href="https://world.openfoodfacts.org/cgi/user.pl" target="_blank" rel="noreferrer" className="text-gold underline">
                Créer un compte
              </a>
            </p>
          )}
          <Field label="Nom d'utilisateur Open Food Facts (pas l'e-mail)">
            <input value={userId} onChange={(e) => setUserId(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" className={inputClass} />
          </Field>
          <Field label="Mot de passe">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={inputClass} />
          </Field>
          <Toggle checked={remember} onChange={setRemember} label="Se souvenir sur ce téléphone" hint="Stocké uniquement sur cet appareil, jamais dans les sauvegardes." />
          {error && <p className="text-danger">{error}</p>}
          <p className="text-xs text-silver-dim">
            Les données envoyées sont publiées sous licence libre (ODbL, photos en CC BY-SA). Un produit déjà présent dans la base n'est jamais modifié.
          </p>
          <Button variant="primary" size="lg" className="w-full" disabled={busy || !userId.trim() || !password} onClick={send}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Globe size={18} />} {busy ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
