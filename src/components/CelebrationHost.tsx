import { useEffect, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { CELEBRATE_EVENT, type CelebrateDetail } from '../lib/celebrate'
import { DEFAULT_CELEBRATION_STYLE } from '../lib/coins'
import type { CelebrationStyle } from '../types'

const DURATION_MS = 1800
const PALETTE = ['var(--color-accent)', 'var(--color-info)', 'var(--color-warning)', 'var(--color-highlight)', 'var(--color-strength)']

// Deterministic pseudo-random so each burst looks varied without Math.random
// in render (keeps renders pure).
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function Confetti({ seed }: { seed: number }) {
  return (
    <>
      {Array.from({ length: 42 }, (_, i) => {
        const style = {
          left: `${rand(seed + i) * 100}%`,
          background: PALETTE[i % PALETTE.length],
          animationDelay: `${rand(seed + i * 7) * 250}ms`,
          '--drift': `${(rand(seed + i * 13) - 0.5) * 120}px`,
          '--spin': `${rand(seed + i * 3) * 720 - 360}deg`,
        } as CSSProperties
        return <span key={i} className="celebrate-confetti" style={style} />
      })}
    </>
  )
}

function Fireworks({ seed }: { seed: number }) {
  const bursts = [
    { x: 30, y: 30 },
    { x: 70, y: 24 },
    { x: 50, y: 45 },
  ]
  return (
    <>
      {bursts.map((b, bi) =>
        Array.from({ length: 14 }, (_, i) => {
          const angle = (i / 14) * Math.PI * 2
          const dist = 70 + rand(seed + bi * 31 + i) * 30
          const style = {
            left: `${b.x}%`,
            top: `${b.y}%`,
            background: PALETTE[(bi + i) % PALETTE.length],
            animationDelay: `${bi * 220}ms`,
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist}px`,
          } as CSSProperties
          return <span key={`${bi}-${i}`} className="celebrate-spark" style={style} />
        }),
      )}
    </>
  )
}

function Pulse() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="celebrate-pulse-ring" />
      <span className="celebrate-pulse-ring" style={{ animationDelay: '250ms' }} />
    </div>
  )
}

/** Full-screen, pointer-transparent overlay that plays the selected
 *  celebration whenever `celebrate()` fires. Reduced-motion users always get
 *  the minimal pulse. */
export default function CelebrationHost() {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const [active, setActive] = useState<{ style: CelebrationStyle; seed: number } | null>(null)
  const selected = settings?.celebrationStyle ?? DEFAULT_CELEBRATION_STYLE

  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<CelebrateDetail>).detail ?? {}
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setActive({ style: reduceMotion ? 'pulse' : (detail.style ?? selected), seed: Date.now() % 1000 })
    }
    window.addEventListener(CELEBRATE_EVENT, handle)
    return () => window.removeEventListener(CELEBRATE_EVENT, handle)
  }, [selected])

  useEffect(() => {
    if (!active) return
    const id = setTimeout(() => setActive(null), DURATION_MS)
    return () => clearTimeout(id)
  }, [active])

  if (!active) return null

  return (
    <div key={active.seed} className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {active.style === 'classic' && <Confetti seed={active.seed} />}
      {active.style === 'fireworks' && <Fireworks seed={active.seed} />}
      {active.style === 'pulse' && <Pulse />}
    </div>
  )
}
