import { GripVertical } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { moveItem } from '../lib/routine-order'
import { cn } from '../lib/utils'

type Drag = { index: number; dy: number; target: number; step: number }
type Start = { index: number; y: number; scrollY: number; tops: number[]; heights: number[]; gap: number; clientY: number; scroller: HTMLElement | null }

/** Conteneur qui défile autour de la liste (fenêtre d'une feuille), ou null pour la page elle-même. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}
const scrollTop = (s: Pick<Start, 'scroller'>) => (s.scroller ? s.scroller.scrollTop : window.scrollY)

/** Place visée : le centre de l'élément tenu a dépassé le milieu de combien de voisins. */
function targetFor(s: Start, dy: number): number {
  const mid = (j: number) => s.tops[j] + s.heights[j] / 2
  const center = mid(s.index) + dy
  let t = s.index
  while (t + 1 < s.tops.length && center > mid(t + 1)) t++
  while (t - 1 >= 0 && center < mid(t - 1)) t--
  return t
}

/** Liste réordonnable au doigt : on attrape la poignée, on glisse, on lâche. La page (ou la feuille qui contient
 *  la liste) défile toute seule près des bords. Au clavier, les flèches haut/bas sur la poignée déplacent l'élément. */
export function SortableList<T>({
  items,
  keyOf,
  labelOf,
  onReorder,
  renderItem,
  className,
}: {
  items: T[]
  keyOf: (item: T) => string
  labelOf: (item: T) => string
  onReorder: (items: T[]) => void
  renderItem: (item: T, handle: ReactNode) => ReactNode
  className?: string
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const start = useRef<Start | null>(null)
  const raf = useRef(0)
  const [drag, setDrag] = useState<Drag | null>(null)
  // Ordre affiché juste après le lâcher, le temps que la base renvoie la liste réordonnée (évite un saut en arrière)
  const [dropped, setDropped] = useState<{ sig: string; keys: string[] } | null>(null)

  const sig = items.map(keyOf).join('|')
  const shown = dropped?.sig === sig ? dropped.keys.map((k) => items.find((i) => keyOf(i) === k)!).filter(Boolean) : items

  const update = () => {
    const s = start.current
    if (!s) return
    const dy = s.clientY - s.y + (scrollTop(s) - s.scrollY)
    // Les voisins s'écartent de la hauteur de l'élément tenu + l'espace entre deux éléments
    setDrag({ index: s.index, dy, target: targetFor(s, dy), step: s.heights[s.index] + s.gap })
  }

  // Défilement automatique quand le doigt approche du haut ou du bas de la zone qui défile
  const autoScroll = () => {
    const s = start.current
    if (!s) return
    const box = s.scroller?.getBoundingClientRect()
    const top = box ? box.top : 0
    const bottom = box ? box.bottom : window.innerHeight - 20
    const edge = Math.min(120, (bottom - top) / 4)
    const y = s.clientY
    const speed = y < top + edge ? -Math.ceil((top + edge - y) / 8) : y > bottom - edge ? Math.ceil((y - (bottom - edge)) / 8) : 0
    if (speed) {
      if (s.scroller) s.scroller.scrollBy(0, speed)
      else window.scrollBy(0, speed)
      update()
    }
    raf.current = requestAnimationFrame(autoScroll)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const finish = (commit: boolean) => {
    const s = start.current
    cancelAnimationFrame(raf.current)
    start.current = null
    const target = s ? targetFor(s, s.clientY - s.y + (scrollTop(s) - s.scrollY)) : -1
    if (commit && s && target !== s.index) {
      const next = moveItem(shown, s.index, target)
      setDropped({ sig, keys: next.map(keyOf) })
      onReorder(next)
    }
    setDrag(null)
  }

  const handle = (index: number, item: T) => (
    <button
      type="button"
      aria-label={`Déplacer « ${labelOf(item)} » (flèches haut et bas)`}
      className="press -ml-1 flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-silver-dim select-none active:cursor-grabbing active:bg-raised [-webkit-touch-callout:none]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1
        if (to < 0 || to >= shown.length) return
        e.preventDefault()
        const next = moveItem(shown, index, to)
        setDropped({ sig, keys: next.map(keyOf) })
        onReorder(next)
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || shown.length < 2) return
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        const rects = shown.map((_, j) => refs.current[j]!.getBoundingClientRect())
        const scroller = scrollParent(refs.current[index]!)
        const sy = scrollTop({ scroller })
        start.current = {
          index,
          y: e.clientY,
          clientY: e.clientY,
          scrollY: sy,
          scroller,
          tops: rects.map((r) => r.top + sy),
          heights: rects.map((r) => r.height),
          gap: rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0,
        }
        navigator.vibrate?.(10)
        update()
        raf.current = requestAnimationFrame(autoScroll)
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        start.current.clientY = e.clientY
        update()
      }}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
    >
      <GripVertical size={20} />
    </button>
  )

  const shift = (j: number) => {
    if (!drag) return 0
    if (j === drag.index) return drag.dy
    if (drag.index < drag.target && j > drag.index && j <= drag.target) return -drag.step
    if (drag.target < drag.index && j >= drag.target && j < drag.index) return drag.step
    return 0
  }

  return (
    <div className={className}>
      {shown.map((item, j) => {
        const held = drag?.index === j
        const dy = shift(j)
        return (
          <div
            key={keyOf(item)}
            ref={(el) => {
              refs.current[j] = el
            }}
            style={dy ? { transform: `translateY(${dy}px)` } : undefined}
            className={cn('relative', drag && !held && 'transition-transform duration-200', held && 'z-20 scale-[1.02] rounded-[18px] shadow-2xl shadow-black/60')}
          >
            {renderItem(item, handle(j, item))}
          </div>
        )
      })}
    </div>
  )
}
