import { useRef, useState, type ReactNode, type TouchEvent } from 'react'

const TRIGGER_PX = 60
const MAX_PULL_PX = 80

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

interface PullToRefreshProps {
  /** When false, renders children untouched (no gesture, no indicator). */
  enabled: boolean
  onRefresh: () => Promise<void>
  children: ReactNode
}

/** Touch pull-down-at-top gesture. Home-screen PWAs on iOS have no native
 *  pull-to-refresh, so this provides one for the content it wraps. */
export default function PullToRefresh({ enabled, onRefresh, children }: PullToRefreshProps) {
  const ref = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  function handleTouchStart(e: TouchEvent) {
    if (!enabled || refreshing) return
    const scroller = scrollParent(ref.current)
    startY.current = (scroller?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null
  }

  function handleTouchMove(e: TouchEvent) {
    if (startY.current === null) return
    const dy = e.touches[0].clientY - startY.current
    setPull(dy > 0 ? Math.min(dy * 0.5, MAX_PULL_PX) : 0)
  }

  async function handleTouchEnd() {
    if (startY.current === null) return
    startY.current = null
    const triggered = pull >= TRIGGER_PX
    setPull(0)
    if (!triggered) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const indicatorHeight = refreshing ? 36 : pull
  return (
    <div
      ref={ref}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {enabled && (
        <div
          className="flex items-end justify-center overflow-hidden text-xs text-ink-faint transition-[height] duration-150"
          style={{ height: indicatorHeight }}
          aria-live="polite"
        >
          {indicatorHeight > 0 && (
            <span className="pb-2">
              {refreshing ? 'Checking Strava…' : pull >= TRIGGER_PX ? 'Release to check Strava' : 'Pull to check Strava'}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
