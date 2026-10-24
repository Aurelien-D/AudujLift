import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { cn, formatNumber, parseNum } from '../lib/utils'
import { SolarSigil } from './SolarSigil'

// ---------- Page ----------

export function Page({
  title,
  back,
  actions,
  children,
  className,
  subtitle,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  back?: boolean | string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh">
      {(title || back || actions) && (
        <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-ink/85 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
            {back && (
              <button
                aria-label="Retour"
                onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
                className="press -ml-2 rounded-full p-2 text-ivory-dim active:bg-raised"
              >
                <ChevronLeft size={24} strokeWidth={1.75} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[19px] font-semibold">{title}</h1>
              {subtitle && <p className="-mt-0.5 truncate text-xs text-silver">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-1">{actions}</div>}
          </div>
        </header>
      )}
      <main className={cn('animate-page mx-auto max-w-xl px-4 pt-4 pb-36', className)}>{children}</main>
    </div>
  )
}

// ---------- Boutons ----------

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'outline'
const VARIANTS: Record<Variant, string> = {
  // Principal : fond Solar Gold, texte sombre, contraste élevé
  primary: 'bg-gold text-ink font-semibold shadow-[0_8px_24px_-12px_rgba(214,181,110,0.6)] active:bg-gold-pale',
  // Secondaire : fond graphite, bordure légère, texte ivoire
  secondary: 'border border-line bg-raised text-ivory active:bg-line',
  // Tertiaire : transparent, accent doré sur l'action
  tertiary: 'text-gold active:bg-gold/10',
  ghost: 'text-ivory-dim active:bg-raised',
  danger: 'border border-danger/25 bg-danger/10 text-danger active:bg-danger/20',
  outline: 'border border-line text-ivory active:bg-raised',
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...props}
      className={cn(
        'press inline-flex items-center justify-center gap-2 rounded-2xl select-none disabled:opacity-40',
        size === 'sm' && 'h-9 rounded-xl px-3 text-sm font-medium',
        size === 'md' && 'h-12 px-4 text-[15px] font-medium',
        size === 'lg' && 'h-14 px-5 text-base font-semibold',
        VARIANTS[variant],
        className,
      )}
    />
  )
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('press rounded-full p-2 text-ivory-dim active:bg-raised disabled:opacity-40', className)} />
}

// ---------- Conteneurs ----------

export function Card({ children, className, onClick, glow }: { children: ReactNode; className?: string; onClick?: () => void; glow?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-[18px] border border-line/70 bg-surface p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]',
        glow && 'solar-glow border-gold/30',
        onClick && 'press cursor-pointer active:bg-raised/60',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-7 mb-2.5 flex items-center justify-between gap-2">
      <h2 className="label flex items-center gap-2 font-sans">
        <span className="h-px w-3 bg-gold/70" aria-hidden />
        {children}
      </h2>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-line px-6 py-10 text-center">
      <div className="mb-1 text-gold/70">{icon ?? <SolarSigil size={40} />}</div>
      <p className="font-display text-lg font-semibold text-ivory">{title}</p>
      {children && <div className="text-sm text-silver">{children}</div>}
    </div>
  )
}

// ---------- Bottom sheet ----------

export function Sheet({ open, onClose, title, children, full }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; full?: boolean }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="animate-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('animate-sheet pb-safe relative flex w-full max-w-xl flex-col rounded-t-[28px] border-t border-line bg-surface', full ? 'h-[94dvh]' : 'max-h-[90dvh]')}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-center gap-2 px-4 pt-2 pb-2">
          <div className="min-w-0 flex-1 font-display text-lg font-semibold">{title}</div>
          <IconButton aria-label="Fermer" onClick={onClose}>
            <X size={22} strokeWidth={1.75} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Liste d'actions dans une feuille (menus contextuels). */
export function ActionList({ items }: { items: { icon?: ReactNode; label: string; onClick: () => void; danger?: boolean; hidden?: boolean }[] }) {
  return (
    <div className="flex flex-col">
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <button
            key={i.label}
            onClick={i.onClick}
            className={cn('press flex items-center gap-3 rounded-xl px-3 py-3.5 text-left active:bg-raised', i.danger ? 'text-danger' : 'text-ivory')}
          >
            <span className={i.danger ? 'text-danger' : 'text-gold'}>{i.icon}</span>
            {i.label}
          </button>
        ))}
    </div>
  )
}

// ---------- Champs ----------

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-silver">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-silver">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-ink px-3 py-3 text-base text-ivory placeholder:text-silver-dim outline-none transition-colors focus:border-gold/70'

/** Champ numérique tolérant la virgule, qui conserve la saisie intermédiaire ("72,"). */
export function NumberInput({
  value,
  onChange,
  className,
  placeholder,
  decimals = true,
  ...rest
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  className?: string
  placeholder?: string
  decimals?: boolean
  'aria-label'?: string
  autoFocus?: boolean
}) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','))
  useEffect(() => {
    // Synchronise si la valeur change de l'extérieur
    if (parseNum(text) !== value) setText(value == null ? '' : String(value).replace('.', ','))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      {...rest}
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      enterKeyHint="next"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setText(t)
        onChange(parseNum(t))
      }}
      className={cn(inputClass, className)}
    />
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(inputClass, 'appearance-none', className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'press shrink-0 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors',
        active ? 'border-gold/60 bg-gold/12 text-gold' : 'border-line bg-surface text-ivory-dim active:bg-raised',
      )}
    >
      {children}
    </button>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex rounded-2xl border border-line/60 bg-surface p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn('press flex-1 rounded-xl py-2 text-sm font-medium transition-colors', value === t.value ? 'bg-raised text-gold shadow-sm' : 'text-silver')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Visualisations ----------

export function Ring({
  value,
  max,
  size = 120,
  stroke = 10,
  color = 'url(#ring-gold)',
  children,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  const over = max > 0 && value > max * 1.05
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E8D3A1" />
            <stop offset="1" stopColor="#D6B56E" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#22252D" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? '#E06B62' : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export function MacroBar({ label, value, goal, color, unit = 'g' }: { label: string; value: number; goal: number; color: string; unit?: string }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-1 text-xs">
        <span className="font-medium text-ivory-dim">{label}</span>
        <span className="truncate text-silver">
          <span className="font-semibold text-ivory">{Math.round(value)}</span>/{goal}
          {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function Stat({ label, value, unit, accent }: { label: string; value: ReactNode; unit?: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium tracking-wide text-silver uppercase">{label}</div>
      <div className={cn('mt-0.5 truncate font-display text-xl font-semibold', accent && 'text-gold')}>
        {value}
        {unit && <span className="ml-1 font-sans text-xs font-medium text-silver">{unit}</span>}
      </div>
    </div>
  )
}

export function MacroLine({ kcal, protein, carbs, fat }: { kcal: number; protein: number; carbs: number; fat: number }) {
  return (
    <span className="text-xs text-silver">
      {Math.round(kcal)} kcal · <span className="text-protein">P {formatNumber(protein, 0)}</span> · <span className="text-carbs">G {formatNumber(carbs, 0)}</span> ·{' '}
      <span className="text-fat">L {formatNumber(fat, 0)}</span>
    </span>
  )
}

/** Petit toast éphémère (records, confirmations) */
export function Toast({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'record' }) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[60] flex justify-center px-4">
      <div
        className={cn(
          'animate-pop pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl',
          tone === 'record' ? 'animate-record border-amethyst-light/40 bg-[#1b1626]/95 text-ivory' : 'border-gold/30 bg-surface/95 text-ivory',
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Interrupteur on/off avec libellé et explication. */
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ivory">{label}</span>
        {hint && <span className="block text-xs text-silver">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-gold/60',
          checked ? 'border-gold bg-gold' : 'border-line bg-raised',
        )}
      >
        <span className={cn('absolute top-0.5 size-5.5 rounded-full shadow transition-transform duration-200', checked ? 'translate-x-5.5 bg-ink' : 'translate-x-0.5 bg-silver')} />
      </span>
    </label>
  )
}
