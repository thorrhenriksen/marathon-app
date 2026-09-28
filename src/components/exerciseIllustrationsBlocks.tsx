// Line-art for the periodization blocks' exercises — same conventions as
// exerciseIllustrations.tsx: 100×100 viewBox, single 3-unit stroke in
// currentColor, stick figures, no faces. A chair/step is drawn as a simple box.

import type { ReactElement } from 'react'

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

function Svg({ className, children }: IllustrationProps & { children: React.ReactNode }) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

const Floor = () => <path d="M8 90 L92 90" strokeWidth={1.5} opacity={0.5} />

export const BoxGobletSquat = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="44" cy="26" r="8" />
    <path d="M44 34 L46 56 L64 60 L62 88 M46 56 L64 60" />
    <path d="M40 42 L48 48 L56 42" />
    <rect x="44" y="46" width="8" height="10" rx="2" />
    <rect x="18" y="64" width="24" height="24" rx="2" />
    <Floor />
  </Svg>
)

export const DbRdl = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="28" cy="34" r="8" />
    <path d="M34 40 L62 50 L60 70 L62 88" />
    <path d="M42 44 L44 66" />
    <rect x="39" y="66" width="10" height="6" rx="2" />
    <Floor />
  </Svg>
)

export const SeatedSoleusRaise = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="36" cy="22" r="8" />
    <path d="M36 30 L36 56 L62 56 L64 80" />
    <path d="M64 80 L74 76" />
    <rect x="52" y="48" width="12" height="6" rx="2" />
    <rect x="22" y="58" width="22" height="30" rx="2" />
    <Floor />
  </Svg>
)

function PushUpFigure({ feetY = 84, className }: IllustrationProps & { feetY?: number }) {
  return (
    <Svg className={className}>
      <circle cx="18" cy={feetY - 30} r="7" />
      <path d={`M25 ${feetY - 26} L86 ${feetY}`} />
      <path d={`M32 ${feetY - 23} L30 90`} />
      {feetY < 84 && <rect x="78" y={feetY} width="16" height={90 - feetY} rx="2" />}
      <Floor />
    </Svg>
  )
}

export const PushUp = (p: IllustrationProps) => <PushUpFigure {...p} />
export const PushUpFeetElevated = (p: IllustrationProps) => <PushUpFigure {...p} feetY={70} />
export const PushUpDeclineTempo = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="18" cy="56" r="7" />
    <path d="M25 58 L84 68" />
    <path d="M32 60 L30 90" />
    <rect x="76" y="68" width="18" height="22" rx="2" />
    <path d="M40 28 L40 44 M34 38 L40 44 L46 38" strokeWidth={2} />
    <Floor />
  </Svg>
)
export const PushUpArcher = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="40" cy="54" r="7" />
    <path d="M46 58 L90 80" />
    <path d="M40 62 L38 90 M40 62 L12 88" />
    <Floor />
  </Svg>
)

export const SideLyingHipAbduction = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="16" cy="74" r="7" />
    <path d="M23 76 L54 80 L90 84" />
    <path d="M54 80 L88 62" />
    <path d="M30 78 L28 88" />
    <Floor />
  </Svg>
)

export const StepUp = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="46" cy="18" r="8" />
    <path d="M46 26 L46 52 L60 58 L60 66 M46 52 L38 72 L34 88" />
    <path d="M46 34 L36 46 M46 34 L56 46" />
    <rect x="52" y="66" width="30" height="22" rx="2" />
    <Floor />
  </Svg>
)

export const CopenhagenShort = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="16" cy="60" r="7" />
    <path d="M23 62 L62 54" />
    <path d="M28 62 L28 80" />
    <path d="M62 54 L74 50 M62 54 L66 70 L70 80" />
    <rect x="68" y="50" width="24" height="38" rx="2" />
    <Floor />
  </Svg>
)

export const CopenhagenLong = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="14" cy="64" r="7" />
    <path d="M21 66 L84 50" />
    <path d="M26 66 L26 82" />
    <path d="M54 58 L62 78" />
    <rect x="76" y="50" width="18" height="38" rx="2" />
    <Floor />
  </Svg>
)

export const DoubleLegCalfRaise = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="50" cy="18" r="8" />
    <path d="M50 26 L50 56 L44 82 M50 56 L56 82" />
    <path d="M44 82 L40 86 M56 82 L60 86" />
    <path d="M50 36 L38 50 M50 36 L62 50" />
    <path d="M36 12 L36 4 M64 12 L64 4" strokeWidth={2} />
    <Floor />
  </Svg>
)

function RfessFigure({ className, mark }: IllustrationProps & { mark?: 'pause' | 'explosive' }) {
  return (
    <Svg className={className}>
      <circle cx="40" cy="22" r="8" />
      <path d="M40 30 L42 54 L28 66 L28 88 M42 54 L60 70 L74 62" />
      <path d="M40 38 L34 52 M40 38 L48 52" />
      <rect x="68" y="62" width="24" height="26" rx="2" />
      {mark === 'pause' && <path d="M12 26 L12 38 M18 26 L18 38" strokeWidth={2.5} />}
      {mark === 'explosive' && <path d="M14 40 L14 20 M8 26 L14 20 L20 26" strokeWidth={2.5} />}
      <Floor />
    </Svg>
  )
}

export const Rfess = (p: IllustrationProps) => <RfessFigure {...p} />
export const RfessPause = (p: IllustrationProps) => <RfessFigure {...p} mark="pause" />
export const RfessExplosive = (p: IllustrationProps) => <RfessFigure {...p} mark="explosive" />

export const NordicCurl = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="66" cy="40" r="7" />
    <path d="M60 46 L40 76" />
    <path d="M40 76 L16 80" />
    <path d="M58 50 L72 64" />
    <rect x="6" y="72" width="16" height="16" rx="2" />
    <Floor />
  </Svg>
)

export const WeightedDeadBug = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="22" cy="62" r="7" />
    <path d="M29 62 L66 62" />
    <path d="M40 62 L40 38" />
    <rect x="34" y="30" width="12" height="7" rx="2" />
    <path d="M52 62 L62 44 L74 44 M66 62 L86 56" />
    <Floor />
  </Svg>
)

export const HollowHold = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="26" cy="56" r="7" />
    <path d="M32 60 Q50 72 70 62 L88 54" />
    <path d="M26 50 L10 42" />
    <Floor />
  </Svg>
)

export const BodySaw = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="26" cy="58" r="7" />
    <path d="M33 62 L86 76" />
    <path d="M34 64 L34 80 L48 80" />
    <path d="M60 48 L76 48 M70 42 L76 48 L70 54 M52 48 L40 48 M46 42 L40 48 L46 54" strokeWidth={2} />
    <Floor />
  </Svg>
)

export const DeficitCalfRaise = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="44" cy="16" r="8" />
    <path d="M44 24 L44 52 L46 74" />
    <path d="M46 74 L58 70" />
    <path d="M44 32 L30 42 M44 32 L58 38" />
    <rect x="30" y="74" width="24" height="14" rx="2" />
    <path d="M78 24 L78 88" strokeWidth={2} opacity={0.6} />
    <Floor />
  </Svg>
)

export const WeightedPullUp = (p: IllustrationProps) => (
  <Svg {...p}>
    <path d="M20 14 L80 14" />
    <circle cx="50" cy="26" r="8" />
    <path d="M30 14 L38 34 M70 14 L62 34" />
    <path d="M50 34 L50 54 L44 74 M50 54 L56 74" />
    <rect x="44" y="74" width="12" height="8" rx="2" />
  </Svg>
)

export const PlyoPrimer = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="36" cy="16" r="7" />
    <path d="M36 23 L36 46 L32 64 L34 70 M36 46 L40 62 L40 70" />
    <path d="M36 30 L28 40 M36 30 L44 40" />
    <path d="M26 80 L46 80" strokeWidth={1.5} strokeDasharray="3 4" />
    <circle cx="72" cy="20" r="7" />
    <path d="M72 27 L72 50 L66 70 M72 50 L84 50 L84 62" />
    <path d="M72 34 L62 30 M72 34 L80 44" />
    <Floor />
  </Svg>
)

export const PlyoPower = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="36" cy="18" r="7" />
    <path d="M36 25 L36 48 L34 68 M36 48 L46 58" />
    <path d="M36 32 L26 42 M36 32 L46 42" />
    <path d="M24 78 L44 78" strokeWidth={1.5} strokeDasharray="3 4" />
    <rect x="62" y="72" width="28" height="16" rx="2" />
    <path d="M52 50 Q62 36 72 62" strokeWidth={2} strokeDasharray="3 4" />
    <Floor />
  </Svg>
)

export const GluteBridge = (p: IllustrationProps) => (
  <Svg {...p}>
    <circle cx="16" cy="78" r="7" />
    <path d="M23 78 L52 64 L66 76 L66 88" />
    <path d="M30 80 L40 84" />
    <Floor />
  </Svg>
)

export const BLOCK_ILLUSTRATIONS: Record<string, (props: IllustrationProps) => ReactElement> = {
  'box-goblet-squat': BoxGobletSquat,
  'db-rdl': DbRdl,
  'seated-soleus-raise': SeatedSoleusRaise,
  'push-up': PushUp,
  'push-up-feet-elevated': PushUpFeetElevated,
  'push-up-decline-tempo': PushUpDeclineTempo,
  'push-up-archer': PushUpArcher,
  'side-lying-hip-abduction': SideLyingHipAbduction,
  'step-up': StepUp,
  'copenhagen-short': CopenhagenShort,
  'copenhagen-long': CopenhagenLong,
  'double-leg-calf-raise': DoubleLegCalfRaise,
  rfess: Rfess,
  'rfess-pause': RfessPause,
  'rfess-explosive': RfessExplosive,
  'nordic-curl': NordicCurl,
  'weighted-dead-bug': WeightedDeadBug,
  'hollow-hold': HollowHold,
  'body-saw': BodySaw,
  'deficit-calf-raise': DeficitCalfRaise,
  'weighted-pull-up': WeightedPullUp,
  'plyo-primer': PlyoPrimer,
  'plyo-power': PlyoPower,
  'glute-bridge': GluteBridge,
}
