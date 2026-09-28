// Minimal single-weight-stroke SVG line-art, one per strength/mobility catalog
// entry. No third-party assets, no faces — just simple stick-figure poses.
// All strokes use currentColor so they follow the active theme.

import type { ReactElement } from 'react'
import { BLOCK_ILLUSTRATIONS } from './exerciseIllustrationsBlocks'

interface IllustrationProps {
  className?: string
}

const commonProps = {
  viewBox: '0 0 100 100',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function GobletSquatIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="50" cy="24" r="8" />
      <path d="M50 32 L50 55 M50 55 L38 78 M50 55 L62 78 M38 78 L34 88 M62 78 L66 88" />
      <path d="M42 40 L50 46 L58 40" />
      <rect x="46" y="46" width="8" height="14" rx="2" />
    </svg>
  )
}

function SingleLegRdlIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="30" cy="24" r="8" />
      <path d="M30 32 L30 45 L60 40" />
      <path d="M30 45 L26 70 L22 88" />
      <path d="M30 45 L70 55 L88 50" />
      <path d="M60 40 L64 34" />
    </svg>
  )
}

function CalfRaiseIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="50" cy="20" r="8" />
      <path d="M50 28 L50 60 L44 84" />
      <path d="M44 84 L58 84 M44 84 L38 88" />
      <path d="M50 40 L36 50 M50 40 L64 46" />
    </svg>
  )
}

function SidePlankIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="20" cy="46" r="8" />
      <path d="M28 46 L82 46" />
      <path d="M40 46 L40 66 L34 74" />
      <path d="M40 46 L58 40 L58 30" />
      <path d="M65 46 L72 62" />
    </svg>
  )
}

function HipFlexorStretchIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="42" cy="26" r="8" />
      <path d="M42 34 L42 55" />
      <path d="M42 55 L22 62 L18 78" />
      <path d="M42 55 L64 70 L64 86" />
      <path d="M42 40 L60 46" />
    </svg>
  )
}

function CouchStretchIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="46" cy="24" r="8" />
      <path d="M46 32 L46 52" />
      <path d="M46 52 L28 60 L26 80" />
      <path d="M46 52 L66 58 L82 58 L82 40" />
      <path d="M46 38 L62 44" />
    </svg>
  )
}

function AnkleRocksIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="46" cy="20" r="8" />
      <path d="M46 28 L46 52" />
      <path d="M46 52 L30 60 L26 82" />
      <path d="M46 52 L62 60 L58 82" />
      <path d="M26 82 L40 82 M58 82 L72 82" />
      <path d="M46 34 L62 40" />
    </svg>
  )
}

function ReverseLungeIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="46" cy="20" r="8" />
      <path d="M46 28 L48 50" />
      <path d="M48 50 L36 70 L34 88" />
      <path d="M48 50 L66 62 L78 84" />
      <path d="M40 36 L46 42 M56 36 L50 42" />
    </svg>
  )
}

function SingleLegGluteBridgeIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="18" cy="60" r="8" />
      <path d="M26 60 L48 60 L60 42 L60 60" />
      <path d="M60 42 L84 30" />
      <path d="M48 60 L48 78" />
    </svg>
  )
}

function PullUpIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <path d="M20 18 L80 18" />
      <circle cx="50" cy="30" r="8" />
      <path d="M30 18 L38 38 M70 18 L62 38" />
      <path d="M50 38 L50 56 L42 80 M50 56 L58 80" />
    </svg>
  )
}

function DeadBugIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="24" cy="50" r="8" />
      <path d="M32 50 L70 50" />
      <path d="M50 50 L38 30 M50 50 L60 68 L60 84" />
      <path d="M70 50 L84 40" />
    </svg>
  )
}

function FrontPlankIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="20" cy="46" r="8" />
      <path d="M28 46 L82 60" />
      <path d="M36 46 L36 66" />
      <path d="M70 56 L70 78" />
    </svg>
  )
}

function HamstringStretchIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="24" cy="30" r="8" />
      <path d="M24 38 L24 58" />
      <path d="M24 58 L60 60" />
      <path d="M60 60 L86 40" />
      <path d="M24 44 L46 40" />
    </svg>
  )
}

function ThoracicRotationsIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="50" cy="20" r="8" />
      <path d="M50 28 L50 58 L42 84 M50 58 L58 84" />
      <path d="M50 38 L30 30" />
      <path d="M50 38 L74 48" />
      <path d="M74 48 L80 40 M74 48 L80 56" strokeDasharray="2 5" />
    </svg>
  )
}

function CalfStretchIllustration({ className }: IllustrationProps) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="30" cy="24" r="8" />
      <path d="M30 32 L34 50 L20 66" />
      <path d="M34 50 L58 46 L82 40" />
      <path d="M82 40 L82 60" />
      <path d="M20 66 L20 82" />
    </svg>
  )
}

const ILLUSTRATION_BY_ID: Record<string, (props: IllustrationProps) => ReactElement> = {
  'goblet-squat': GobletSquatIllustration,
  'single-leg-rdl': SingleLegRdlIllustration,
  'single-leg-calf-raise': CalfRaiseIllustration,
  'side-plank': SidePlankIllustration,
  'hip-flexor-stretch': HipFlexorStretchIllustration,
  'couch-stretch': CouchStretchIllustration,
  'ankle-rocks': AnkleRocksIllustration,
  'reverse-lunge': ReverseLungeIllustration,
  'single-leg-glute-bridge': SingleLegGluteBridgeIllustration,
  'pull-ups': PullUpIllustration,
  'dead-bug': DeadBugIllustration,
  'front-plank': FrontPlankIllustration,
  'hamstring-stretch': HamstringStretchIllustration,
  'thoracic-rotations': ThoracicRotationsIllustration,
  'calf-stretch': CalfStretchIllustration,
}

export function ExerciseIllustration({ exerciseId, className }: { exerciseId: string; className?: string }) {
  const Illustration = ILLUSTRATION_BY_ID[exerciseId] ?? BLOCK_ILLUSTRATIONS[exerciseId]
  if (!Illustration) return null
  return <Illustration className={className} />
}
