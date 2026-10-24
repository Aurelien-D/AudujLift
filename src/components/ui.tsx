import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { cn, formatNumber, parseNum } from '../lib/utils'

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
        <header className="pt-safe sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/85 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
            {back && (
              <button
                aria-label="Retour"
                onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
                className="-ml-2 rounded-full p-2 text-zinc-300 active:bg-zinc-800"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold">{title}</h1>
              {subtitle && <p className="-mt-0.5 truncate text-xs text-zinc-400">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-1">{actions}</div>}
          </div>
        </header>
      )}
      <main className={cn('mx-auto max-w-xl px-4 pt-4 pb-36', className)}>{children}</main>
    </div>
  )
}

// ---------- Boutons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-accent text-zinc-950 font-semibold shadow-lg shadow-lime-500/10 active:brightness-90',
  secondary: 'bg-zinc-800 text-zinc-100 active:bg-zinc-700',
  ghost: 'text-zinc-300 active:bg-zinc-800',
  danger: 'bg-rose-500/15 text-rose-400 active:bg-rose-500/25',
  outline: 'border border-zinc-700 text-zinc-200 active:bg-zinc-800',
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl transition select-none disabled:opacity-40',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-sm font-medium',
        size === 'lg' && 'h-13 px-5 text-base font-semibold',
        VARIANTS[variant],
        className,
      )}
    />
  )
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('rounded-full p-2 text-zinc-300 transition active:bg-zinc-800 disabled:opacity-40', className)} />
}

// ---------- Conteneurs ----------

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn('rounded-2xl border border-zinc-800/70 bg-zinc-900/70 p-4', onClick && 'cursor-pointer transition active:bg-zinc-800/70', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{children}</h2>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-800 px-6 py-10 text-center">
      {icon && <div className="text-zinc-600">{icon}</div>}
      <p className="font-semibold text-zinc-200">{title}</p>
      {children && <div className="text-sm text-zinc-400">{children}</div>}
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
      <div className={cn('animate-sheet pb-safe relative flex w-full max-w-xl flex-col rounded-t-3xl border-t border-zinc-800 bg-zinc-900', full ? 'h-[94dvh]' : 'max-h-[90dvh]')}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div className="min-w-0 flex-1 text-lg font-bold">{title}</div>
          <IconButton aria-label="Fermer" onClick={onClose}>
            <X size={22} />
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
            className={cn('flex items-center gap-3 rounded-xl px-3 py-3.5 text-left active:bg-zinc-800', i.danger ? 'text-rose-400' : 'text-zinc-100')}
          >
            <span className="text-zinc-400">{i.icon}</span>
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
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

export const inputClass = 'w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-base text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-lime-400/60'

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
        'shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition',
        active ? 'border-lime-400/60 bg-lime-400/15 text-lime-300' : 'border-zinc-800 bg-zinc-900 text-zinc-300 active:bg-zinc-800',
      )}
    >
      {children}
    </button>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex rounded-xl bg-zinc-900 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn('flex-1 rounded-lg py-2 text-sm font-medium transition', value === t.value ? 'bg-zinc-700 text-white' : 'text-zinc-400')}
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
  color = 'url(#ring-grad)',
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
  const over = max > 0 && value > max
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a3e635" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#27272a" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? '#fb7185' : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .5s ease' }}
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
      <div className="mb-1 flex items-baseline justify-between gap-1 text-xs">
        <span className="font-medium text-zinc-300">{label}</span>
        <span className="truncate text-zinc-500">
          <span className="text-zinc-200">{Math.round(value)}</span>/{goal}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function Stat({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="truncate text-lg font-bold">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-zinc-400">{unit}</span>}
      </div>
    </div>
  )
}

export function MacroLine({ kcal, protein, carbs, fat }: { kcal: number; protein: number; carbs: number; fat: number }) {
  return (
    <span className="text-xs text-zinc-400">
      {Math.round(kcal)} kcal · <span className="text-protein">P {formatNumber(protein, 0)}</span> · <span className="text-carbs">G {formatNumber(carbs, 0)}</span> ·{' '}
      <span className="text-fat">L {formatNumber(fat, 0)}</span>
    </span>
  )
}
