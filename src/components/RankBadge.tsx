import type { RankResult } from '../lib/stats'
import { cn } from '../lib/utils'

export function RankBadge({ result, size = 'md' }: { result: RankResult; size?: 'sm' | 'md' | 'lg' }) {
  const { rank } = result
  const long = rank.short.length > 1
  const dim =
    size === 'lg' ? cn('size-16', long ? 'text-xl' : 'text-2xl') : size === 'md' ? cn('size-11', long ? 'text-sm' : 'text-base') : cn('size-8', long ? 'text-[10px]' : 'text-xs')
  return (
    <div
      className={cn('font-display relative flex shrink-0 items-center justify-center font-semibold', dim)}
      style={{
        color: rank.color,
        filter: `drop-shadow(0 0 8px ${rank.color}30)`,
      }}
      title={result.label}
    >
      <svg viewBox="0 0 40 44" className="absolute inset-0 size-full">
        <path d="M20 2 L37 11 V31 L20 42 L3 31 V11 Z" fill={`${rank.color}14`} stroke={rank.color} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span className="relative">{rank.short}</span>
      {result.division && size !== 'sm' && (
        <span className="absolute -bottom-1 rounded-full border border-current bg-ink px-1 text-[9px] leading-[13px] font-semibold">
          {['', 'I', 'II', 'III', 'IV'][result.division]}
        </span>
      )}
    </div>
  )
}

export function RankProgress({ result }: { result: RankResult }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="font-semibold" style={{ color: result.rank.color }}>
          {result.label}
        </span>
        {result.nextLabel && <span className="text-silver">{result.nextLabel}</span>}
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full" style={{ width: `${result.stepProgress * 100}%`, background: result.rank.color }} />
      </div>
    </div>
  )
}
