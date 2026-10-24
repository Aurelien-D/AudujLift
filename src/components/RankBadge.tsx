import type { RankResult } from '../lib/stats'
import { cn } from '../lib/utils'

export function RankBadge({ result, size = 'md' }: { result: RankResult; size?: 'sm' | 'md' | 'lg' }) {
  const { rank } = result
  const dim = size === 'lg' ? 'size-16 text-2xl' : size === 'md' ? 'size-11 text-base' : 'size-8 text-xs'
  return (
    <div
      className={cn('font-display relative flex shrink-0 items-center justify-center font-semibold', dim)}
      style={{
        color: rank.color,
        filter: `drop-shadow(0 0 8px ${rank.color}30)`,
      }}
      title={rank.name}
    >
      <svg viewBox="0 0 40 44" className="absolute inset-0 size-full">
        <path d="M20 2 L37 11 V31 L20 42 L3 31 V11 Z" fill={`${rank.color}14`} stroke={rank.color} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span className="relative">{rank.name.charAt(0)}</span>
    </div>
  )
}

export function RankProgress({ result }: { result: RankResult }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="font-semibold" style={{ color: result.rank.color }}>
          {result.rank.name}
        </span>
        {result.next && <span className="text-silver">{result.next.name}</span>}
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full" style={{ width: `${result.progress * 100}%`, background: result.next?.color ?? result.rank.color }} />
      </div>
    </div>
  )
}
