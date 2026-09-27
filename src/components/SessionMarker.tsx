import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { DEFAULT_ICON_PACK } from '../lib/coins'
import type { IconPack, SessionType } from '../types'

// Tiny per-type glyphs for the "Tiny glyphs" icon pack, drawn on a 10×10 grid
// in currentColor so they pick up whatever type/status color is passed in.
const GLYPHS: Record<SessionType, ReactNode> = {
  easy: <circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  long: <rect x="0.5" y="3.5" width="9" height="3" rx="1.5" />,
  tempo: <path d="M5 1 9.2 9H.8Z" />,
  'marathon-pace': <path d="M5 .5 9.5 5 5 9.5.5 5Z" />,
  strides: <path d="M1 2l3 3-3 3M5.5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  race: <path d="M5 .6 6.3 3.6l3.2.3-2.4 2.1.7 3.2L5 7.5 2.2 9.2l.7-3.2L.5 3.9l3.2-.3Z" />,
  rest: <rect x="2" y="4.2" width="6" height="1.6" rx=".8" />,
  strength: <path d="M.5 3.5h2v3h-2ZM7.5 3.5h2v3h-2ZM2.5 4.3h5v1.4h-5Z" />,
}

function useIconPack(): IconPack {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  return settings?.iconPack ?? DEFAULT_ICON_PACK
}

interface SessionMarkerProps {
  type: SessionType
  /** A Tailwind bg-* color class (type color or status color). */
  colorClass: string
  /** Pixel size of the marker box. */
  size?: 6 | 8 | 10
  pack?: IconPack
  children?: ReactNode
}

/** Session-type marker for the week strip and calendars, rendered in the
 *  selected icon pack: classic dots, tiny glyphs, or filled squares. */
export default function SessionMarker({ type, colorClass, size = 8, pack, children }: SessionMarkerProps) {
  const selectedPack = useIconPack()
  const activePack = pack ?? selectedPack
  const box = { width: size, height: size }

  if (activePack === 'glyphs') {
    const textColor = colorClass.replace(/(^|\s)bg-/g, '$1text-')
    return (
      <svg viewBox="0 0 10 10" style={box} className={`shrink-0 fill-current ${textColor}`} aria-hidden="true">
        {GLYPHS[type]}
      </svg>
    )
  }

  return (
    <span
      style={box}
      className={`relative flex shrink-0 items-center justify-center ${activePack === 'squares' ? 'rounded-[2px]' : 'rounded-full'} ${colorClass}`}
    >
      {children}
    </span>
  )
}
