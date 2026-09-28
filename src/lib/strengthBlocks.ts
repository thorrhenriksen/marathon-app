// Six-block strength periodization for weeks 6–35. Sessions stay at 5–6
// exercises and ≤25 min, alternating A (heavier legs + push, plyo primer from
// block 3) and B (hip/adductor/hamstring + pull). Each block swaps only a few
// exercises; everything else progresses by double progression — reps to the
// top of the range at RPE ≤8, then load, then tempo.
//
// Scheduling rules:
//   • Session A never lands within 48 h before the Sunday long run, an
//     MP/tempo session, or a gate race — swap A↔B, else drop the plyos.
//   • Gate-race weeks skip session A if it would land within 48 h of the race.
//   • Cutback running weeks take one set off everything.
//   • The Monday after a ≥26 km long run is mobility-only (kept from the
//     original A/B scheduler).

import { addDays, daysBetween } from './dates'
import { getCatalogEntry, buildMobilityOnlyExercises, MOBILITY_ONLY_ESTIMATED_MINUTES } from './strengthCatalog'
import type { Session, SessionExercise, SessionType, StrengthSlot, StrengthVariant } from '../types'

export const PERIODIZATION_START_WEEK = 6

type Range = number | [number, number]

export interface SlotPrescription {
  id: string
  slot: StrengthSlot
  sets: number
  reps?: Range
  holdSeconds?: Range
  perSide?: boolean
  /** Replaces the reps/hold text, e.g. "max − 2 (or slow negatives)". */
  text?: string
  /** Appended after the dose, e.g. "3-1-1 tempo". */
  note?: string
  isPlyo?: boolean
}

export interface StrengthBlock {
  block: number
  name: string
  weeks: [number, number]
  A: SlotPrescription[]
  B: SlotPrescription[]
}

const PULL_UPS: SlotPrescription = { id: 'pull-ups', slot: 'pull', sets: 3, text: 'max − 2 (or slow negatives)' }

export const STRENGTH_BLOCKS: StrengthBlock[] = [
  {
    block: 1,
    name: 'Foundation',
    weeks: [6, 10],
    A: [
      { id: 'box-goblet-squat', slot: 'squat', sets: 3, reps: 10, note: '3-1-1 tempo' },
      { id: 'db-rdl', slot: 'hinge', sets: 3, reps: 10 },
      { id: 'seated-soleus-raise', slot: 'calf', sets: 3, reps: 15 },
      { id: 'push-up', slot: 'push', sets: 3, reps: [8, 12], note: 'incline if under 8' },
      { id: 'dead-bug', slot: 'core', sets: 3, reps: 8, perSide: true },
      { id: 'side-lying-hip-abduction', slot: 'abductor', sets: 2, reps: 15, perSide: true },
    ],
    B: [
      { id: 'step-up', slot: 'step', sets: 3, reps: 8, perSide: true },
      { id: 'single-leg-glute-bridge', slot: 'hamstring', sets: 3, reps: 10, perSide: true },
      PULL_UPS,
      { id: 'copenhagen-short', slot: 'adductor', sets: 3, holdSeconds: [15, 20], perSide: true },
      { id: 'double-leg-calf-raise', slot: 'calf', sets: 3, reps: 15 },
      { id: 'side-plank', slot: 'core', sets: 2, holdSeconds: 30, perSide: true },
    ],
  },
  {
    block: 2,
    name: 'Unilateral strength',
    weeks: [11, 16],
    A: [
      { id: 'rfess', slot: 'squat', sets: 3, reps: 8, perSide: true },
      { id: 'db-rdl', slot: 'hinge', sets: 3, reps: 10 },
      { id: 'seated-soleus-raise', slot: 'calf', sets: 3, reps: 15 },
      { id: 'push-up-feet-elevated', slot: 'push', sets: 3, reps: [8, 12] },
      { id: 'weighted-dead-bug', slot: 'core', sets: 3, reps: 8, perSide: true },
      { id: 'hollow-hold', slot: 'core', sets: 3, holdSeconds: [20, 30] },
    ],
    B: [
      { id: 'step-up', slot: 'step', sets: 3, reps: 8, perSide: true },
      { id: 'single-leg-rdl', slot: 'hinge', sets: 3, reps: 8, perSide: true },
      { id: 'nordic-curl', slot: 'hamstring', sets: 2, reps: 4, note: 'partial range' },
      PULL_UPS,
      { id: 'copenhagen-long', slot: 'adductor', sets: 3, holdSeconds: [15, 20], perSide: true },
      { id: 'side-plank', slot: 'core', sets: 2, holdSeconds: 30, perSide: true },
    ],
  },
  {
    block: 3,
    name: 'Strength + plyos',
    weeks: [17, 22],
    A: [
      { id: 'plyo-primer', slot: 'plyo', sets: 1, text: 'pogos 3 × 15 contacts + A-skips 2 × 20 m', isPlyo: true },
      { id: 'rfess-pause', slot: 'squat', sets: 4, reps: 6, perSide: true, note: '2 s pause' },
      { id: 'db-rdl', slot: 'hinge', sets: 3, reps: 10 },
      { id: 'deficit-calf-raise', slot: 'calf', sets: 3, reps: 12, perSide: true },
      { id: 'push-up-decline-tempo', slot: 'push', sets: 3, reps: [8, 10], note: '3-1-1 tempo' },
      { id: 'body-saw', slot: 'core', sets: 3, reps: 8 },
    ],
    B: [
      { id: 'step-up', slot: 'step', sets: 3, reps: 8, perSide: true },
      { id: 'single-leg-rdl', slot: 'hinge', sets: 3, reps: 8, perSide: true },
      { id: 'nordic-curl', slot: 'hamstring', sets: 3, reps: 5, note: 'partial range' },
      PULL_UPS,
      { id: 'copenhagen-long', slot: 'adductor', sets: 3, holdSeconds: [15, 20], perSide: true },
      { id: 'side-plank', slot: 'core', sets: 2, holdSeconds: 30, perSide: true },
    ],
  },
  {
    // Peak mileage + gate races: volume trimmed one set across the board.
    block: 4,
    name: 'Power',
    weeks: [23, 29],
    A: [
      { id: 'plyo-power', slot: 'plyo', sets: 1, text: 'single-leg pogos + low step jumps, ≤80 contacts', isPlyo: true },
      { id: 'rfess-explosive', slot: 'squat', sets: 3, reps: 5, perSide: true, note: 'explosive up' },
      { id: 'db-rdl', slot: 'hinge', sets: 2, reps: 10 },
      { id: 'deficit-calf-raise', slot: 'calf', sets: 2, reps: 12, perSide: true },
      { id: 'push-up-archer', slot: 'push', sets: 2, reps: 6, perSide: true, note: 'or tempo push-ups' },
      { id: 'body-saw', slot: 'core', sets: 2, reps: 8 },
    ],
    B: [
      { id: 'step-up', slot: 'step', sets: 2, reps: 8, perSide: true },
      { id: 'single-leg-rdl', slot: 'hinge', sets: 2, reps: 8, perSide: true },
      { id: 'nordic-curl', slot: 'hamstring', sets: 2, reps: 5 },
      { id: 'weighted-pull-up', slot: 'pull', sets: 2, text: 'max − 2, dumbbell between the feet' },
      { id: 'copenhagen-long', slot: 'adductor', sets: 2, holdSeconds: [15, 20], perSide: true },
      { id: 'side-plank', slot: 'core', sets: 1, holdSeconds: 30, perSide: true },
    ],
  },
]

/** Block 5 (maintenance, wk 30–32): block 4's exercises at 2 sets, RPE 7,
 *  plyos capped at 40 contacts, Nordics dropped. */
function maintenanceOf(list: SlotPrescription[]): SlotPrescription[] {
  return list
    .filter((p) => p.id !== 'nordic-curl')
    .map((p) =>
      p.isPlyo
        ? { ...p, text: 'single-leg pogos + low step jumps, ≤40 contacts' }
        : { ...p, sets: 2, note: p.note ? `${p.note} · RPE 7` : 'RPE 7' },
    )
}

const BLOCK_4 = STRENGTH_BLOCKS[3]
STRENGTH_BLOCKS.push(
  { block: 5, name: 'Maintenance', weeks: [30, 32], A: maintenanceOf(BLOCK_4.A), B: maintenanceOf(BLOCK_4.B) },
  { block: 6, name: 'Taper', weeks: [33, 35], A: maintenanceOf(BLOCK_4.A), B: maintenanceOf(BLOCK_4.B) },
)

const ACTIVATION: SlotPrescription[] = [
  { id: 'glute-bridge', slot: 'activation', sets: 2, reps: 10 },
  { id: 'side-plank', slot: 'activation', sets: 2, holdSeconds: 20, perSide: true },
  { id: 'double-leg-calf-raise', slot: 'activation', sets: 2, reps: 12 },
  { id: 'dead-bug', slot: 'activation', sets: 2, reps: 6, perSide: true },
]

export function blockForWeek(week: number): StrengthBlock | undefined {
  return STRENGTH_BLOCKS.find((b) => week >= b.weeks[0] && week <= b.weeks[1])
}

// --- Prescription → SessionExercise ------------------------------------------

function rangeText(r: Range): string {
  return Array.isArray(r) ? `${r[0]}–${r[1]}` : String(r)
}

function scaleRange(r: Range, factor: number): Range {
  const s = (n: number) => Math.max(1, Math.round(n * factor))
  return Array.isArray(r) ? [s(r[0]), s(r[1])] : s(r)
}

function top(r: Range): number {
  return Array.isArray(r) ? r[1] : r
}

export function formatPrescription(p: SlotPrescription): string {
  const dose = p.text ?? (p.reps !== undefined ? rangeText(p.reps) : p.holdSeconds !== undefined ? `${rangeText(p.holdSeconds)} s` : '')
  const side = p.perSide && !p.text ? '/side' : ''
  const base = p.isPlyo ? dose : `${p.sets} × ${dose}${side}`
  return p.note ? `${base} · ${p.note}` : base
}

interface Adjust {
  setDelta?: number
  doseScale?: number
}

function adjusted(p: SlotPrescription, adjust: Adjust): SlotPrescription {
  if (p.isPlyo) return p
  const sets = Math.max(1, p.sets + (adjust.setDelta ?? 0))
  const scale = adjust.doseScale ?? 1
  return {
    ...p,
    sets,
    reps: p.reps !== undefined && scale !== 1 ? scaleRange(p.reps, scale) : p.reps,
    holdSeconds: p.holdSeconds !== undefined && scale !== 1 ? scaleRange(p.holdSeconds, scale) : p.holdSeconds,
  }
}

export function toSessionExercise(p: SlotPrescription): SessionExercise {
  const entry = getCatalogEntry(p.id)
  if (!entry) throw new Error(`Unknown strength exercise id: ${p.id}`)
  return {
    exerciseId: entry.id,
    name: entry.name,
    sets: p.sets,
    reps: p.reps !== undefined ? top(p.reps) : undefined,
    holdSeconds: p.reps === undefined && p.holdSeconds !== undefined ? top(p.holdSeconds) : undefined,
    formCue: entry.formCue,
    completed: false,
    prescription: formatPrescription(p),
    slot: p.slot,
    isPlyo: p.isPlyo,
  }
}

/** Week-specific tweaks inside a block (Nordics build 2×4 → 3×5 across block 2). */
function forWeek(p: SlotPrescription, week: number): SlotPrescription {
  if (p.id === 'nordic-curl' && week >= 14 && week <= 16) return { ...p, sets: 3, reps: 5 }
  return p
}

export function estimateMinutes(exercises: SessionExercise[]): number {
  const totalSets = exercises.reduce((sum, e) => sum + (e.isPlyo ? 3 : e.sets), 0)
  return Math.min(25, Math.round(4 + totalSets * 1.1))
}

// --- Scheduling --------------------------------------------------------------

export interface PlannedRunDay {
  week: number
  date: string
  type: SessionType
  plannedDistanceKm: number
}

export interface StrengthWeekContext {
  week: number
  weekStart: string
  isCutback: boolean
  isGateRaceWeek: boolean
  /** Running sessions in this week and the first days of the next one. */
  runs: PlannedRunDay[]
  /** Distance of the previous week's Sunday long/race run, if any. */
  previousSundayKm?: number
}

const KEY_SESSION_TYPES: SessionType[] = ['long', 'tempo', 'marathon-pace', 'race']
const LONG_RUN_DOWNGRADE_THRESHOLD_KM = 26
const MONDAY = 0
const WEDNESDAY = 2

/** True when a key run (long, MP/tempo, race) falls within 48 h after `date`. */
export function hasKeySessionWithin48h(date: string, runs: PlannedRunDay[]): boolean {
  return runs.some((r) => {
    if (!KEY_SESSION_TYPES.includes(r.type)) return false
    const gap = daysBetween(date, r.date)
    return gap > 0 && gap <= 2
  })
}

function raceWithin48h(date: string, runs: PlannedRunDay[]): boolean {
  return runs.some((r) => r.type === 'race' && daysBetween(date, r.date) >= 0 && daysBetween(date, r.date) <= 2)
}

interface PlannedStrength {
  dayOffset: number
  variant?: StrengthVariant
  exercises: SessionExercise[]
  description: string
  estimatedMinutes: number
  status: Session['status']
}

function makeSession(
  ctx: StrengthWeekContext,
  block: StrengthBlock,
  variant: StrengthVariant,
  dayOffset: number,
  adjust: Adjust,
  options: { dropPlyos?: boolean; label?: string } = {},
): PlannedStrength {
  const list = (variant === 'A' ? block.A : block.B)
    .filter((p) => !(options.dropPlyos && p.isPlyo))
    .map((p) => toSessionExercise(adjusted(forWeek(p, ctx.week), adjust)))
  const suffix = options.label ?? `Block ${block.block} · ${block.name}`
  return {
    dayOffset,
    variant,
    exercises: list,
    description: `Strength — Session ${variant} · ${suffix}`,
    estimatedMinutes: estimateMinutes(list),
    status: 'planned',
  }
}

function activation(dayOffset: number, minutes: number): PlannedStrength {
  const exercises = ACTIVATION.map(toSessionExercise)
  return {
    dayOffset,
    exercises,
    description: `Strength — ${minutes}-min activation · Taper`,
    estimatedMinutes: minutes,
    status: 'planned',
  }
}

/** The strength sessions for one plan week (weeks ≥ 6). */
export function planStrengthWeek(ctx: StrengthWeekContext): PlannedStrength[] {
  const block = blockForWeek(ctx.week)
  if (!block) return []

  // Taper (block 6): fixed shape counted back from race day.
  if (block.block === 6) {
    if (ctx.week === 33) {
      const adjust = { doseScale: 0.6 }
      return [
        makeSession(ctx, block, 'A', MONDAY, adjust, { label: 'Taper · ~60% volume, last plyos' }),
        makeSession(ctx, block, 'B', WEDNESDAY, adjust, { label: 'Taper · ~60% volume' }),
      ]
    }
    if (ctx.week === 34) {
      return [
        makeSession(ctx, block, 'A', MONDAY, { setDelta: -1 }, { dropPlyos: true, label: 'Taper · light, last loaded session' }),
        activation(WEDNESDAY, 10),
      ]
    }
    return [activation(MONDAY, 12)]
  }

  const adjust: Adjust = { setDelta: ctx.isCutback ? -1 : 0 }
  const monday = addDays(ctx.weekStart, MONDAY)
  const wednesday = addDays(ctx.weekStart, WEDNESDAY)

  // Session A placement: Monday unless a key session is within 48 h, then
  // swap to Wednesday; if both clash, keep Monday without plyos.
  let aOffset = MONDAY
  let bOffset = WEDNESDAY
  let dropPlyos = false
  if (hasKeySessionWithin48h(monday, ctx.runs)) {
    if (!hasKeySessionWithin48h(wednesday, ctx.runs)) {
      aOffset = WEDNESDAY
      bOffset = MONDAY
    } else {
      dropPlyos = true
    }
  }
  const aDate = addDays(ctx.weekStart, aOffset)
  const skipA = ctx.isGateRaceWeek && raceWithin48h(aDate, ctx.runs)

  const out: PlannedStrength[] = []
  if (!skipA) out.push(makeSession(ctx, block, 'A', aOffset, adjust, { dropPlyos }))
  out.push(makeSession(ctx, block, 'B', bOffset, adjust))

  // Kept from the original scheduler: after a ≥26 km long run, Monday's
  // session is mobility-only. It stays 'planned' — 'downgraded-to-mobility'
  // is reserved for the user's own call (it feeds the Smart call badge).
  if ((ctx.previousSundayKm ?? 0) >= LONG_RUN_DOWNGRADE_THRESHOLD_KM) {
    const mondaySession = out.find((s) => s.dayOffset === MONDAY)
    if (mondaySession?.variant) {
      mondaySession.exercises = buildMobilityOnlyExercises(mondaySession.variant)
      mondaySession.estimatedMinutes = MOBILITY_ONLY_ESTIMATED_MINUTES
      mondaySession.description = `Strength — Session ${mondaySession.variant} (mobility only after the long run)`
    }
  }

  return out.sort((x, y) => x.dayOffset - y.dayOffset)
}

export function buildStrengthSessionsForWeek(ctx: StrengthWeekContext): Session[] {
  const block = blockForWeek(ctx.week)
  return planStrengthWeek(ctx).map((p) => ({
    id: crypto.randomUUID(),
    week: ctx.week,
    date: addDays(ctx.weekStart, p.dayOffset),
    type: 'strength',
    plannedDistanceKm: 0,
    description: p.description,
    status: p.status,
    variant: p.variant,
    exercises: p.exercises,
    estimatedMinutes: p.estimatedMinutes,
    strengthBlock: block?.block,
  }))
}

// --- Display-time guard ------------------------------------------------------

const PLYO_INJURY_LOOKBACK_DAYS = 14

/** Plyos appear only if no knee/toe injury variant was used in the two
 *  weeks before the session (every variant covers knees and/or toes). */
export function effectiveStrengthExercises(session: Session, allSessions: Session[]): SessionExercise[] {
  const exercises = session.exercises ?? []
  if (!exercises.some((e) => e.isPlyo)) return exercises
  const from = addDays(session.date, -PLYO_INJURY_LOOKBACK_DAYS)
  const recentVariant = allSessions.some(
    (s) => s.id !== session.id && s.injuryVariant && s.date >= from && s.date < session.date,
  )
  return recentVariant ? exercises.filter((e) => !e.isPlyo) : exercises
}

/** "3 × 10" style dose for any SessionExercise, preferring its prescription. */
export function exerciseDose(e: SessionExercise): string {
  if (e.prescription) return e.prescription
  return `${e.sets} × ${e.reps ?? `${e.holdSeconds}s`}`
}

/** "Session A" / "Session B", or "Activation" for taper activation sessions. */
export function strengthSessionLabel(session: Pick<Session, 'variant' | 'estimatedMinutes' | 'exercises'>): string {
  if (session.variant) return `Session ${session.variant}`
  return 'Activation'
}
