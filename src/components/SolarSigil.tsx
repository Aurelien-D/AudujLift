import { useId } from 'react'
import { SIGIL_FRACTURE, SIGIL_RAYS } from '../lib/sigil'
import { cn } from '../lib/utils'

/**
 * Signature Dark Solar : soleil géométrique fracturé.
 * Utilise currentColor ; lisible dès 16 px.
 */
export function SolarSigil({ size = 28, className, title }: { size?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn('shrink-0', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <mask id={`m${id}`}>
          <rect width="64" height="64" fill="#fff" />
          <path d={SIGIL_FRACTURE} fill="none" stroke="#000" strokeWidth="2.6" strokeLinejoin="miter" />
        </mask>
      </defs>
      <g mask={`url(#m${id})`} fill="currentColor">
        <path d={SIGIL_RAYS} />
        <circle cx="32" cy="32" r="12.5" />
        <circle cx="32" cy="32" r="15" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      </g>
    </svg>
  )
}
