// Derived, never-stored race-readiness statistics for the Progress tab's
// Statistics segment. Mirrors achievements.ts's style: every value here is
// recomputed from runs/sessions/weeks on every load, nothing is persisted.

import { daysBetween } from './dates'
import { computeTotalDistanceKm } from './achievements'
import type { Run, Session, WeekMeta } from '../types'

/** Re-exported under a name that fits its Statistics-tab framing (a running
 *  total to date, never "X km remaining to race day"). */
export { computeTotalDistanceKm as computeCumulativeDistanceKm }

function findRunForSession(session: Session, runs: Run[]): Run | undefined {
  if (session.linkedRunId) {
    const byId = runs.find((r) => r.id === session.linkedRunId)
    if (byId) return byId
  }
  return (
    runs.find((r) => r.linkedSessionId === session.id) ??
    runs.find((r) => r.date === session.date && r.type === session.type)
  )
}

// --- Quality run + race predictor -----------------------------------------

const QUALITY_RUN_MIN_KM = 3
const QUALITY_RUN_LOOKBACK_DAYS = 42
const RIEGEL_EXPONENT = 1.06
const MARATHON_KM = 42.195
const HALF_MARATHON_KM = 21.0975
const MARATHON_RANGE_HIGH_MULTIPLIER = 1.05

export interface QualityRun {
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number
  date: string
}

/** Fastest pace among runs of at least 3km logged within the last 6 weeks.
 *  Returns undefined when no qualifying run exists — callers must render an
 *  explicit empty state rather than falling back to stale data. */
export function findQualityRun(runs: Run[], today: string): QualityRun | undefined {
  const eligible = runs.filter((r) => {
    if (r.distanceKm < QUALITY_RUN_MIN_KM || r.paceSecPerKm <= 0) return false
    const age = daysBetween(r.date, today)
    return age >= 0 && age <= QUALITY_RUN_LOOKBACK_DAYS
  })
  if (eligible.length === 0) return undefined
  const fastest = eligible.reduce((best, r) => (r.paceSecPerKm < best.paceSecPerKm ? r : best))
  return {
    distanceKm: fastest.distanceKm,
    durationSeconds: fastest.durationSeconds,
    paceSecPerKm: fastest.paceSecPerKm,
    date: fastest.date,
  }
}

export interface RacePredictions {
  sourceRun: QualityRun
  fiveKSeconds: number
  tenKSeconds: number
  halfMarathonSeconds: number
  /** Marathon is always a range, never a single number or confidence %. */
  marathonLowSeconds: number
  marathonHighSeconds: number
}

function riegel(t1Seconds: number, d1Km: number, d2Km: number): number {
  return t1Seconds * Math.pow(d2Km / d1Km, RIEGEL_EXPONENT)
}

/** Riegel-formula (T2 = T1 x (D2/D1)^1.06) predictions from a single quality
 *  run. Marathon is deliberately a range (Riegel .. Riegel x 1.05) — Riegel's
 *  extrapolation error grows with distance ratio, so a single marathon number
 *  overstates precision (see Vickers & Vertosick 2016). */
export function predictRaceTimes(qualityRun: QualityRun): RacePredictions {
  const { durationSeconds: t1, distanceKm: d1 } = qualityRun
  const marathonLowSeconds = riegel(t1, d1, MARATHON_KM)
  return {
    sourceRun: qualityRun,
    fiveKSeconds: riegel(t1, d1, 5),
    tenKSeconds: riegel(t1, d1, 10),
    halfMarathonSeconds: riegel(t1, d1, HALF_MARATHON_KM),
    marathonLowSeconds,
    marathonHighSeconds: marathonLowSeconds * MARATHON_RANGE_HIGH_MULTIPLIER,
  }
}

// --- On-track status --------------------------------------------------------

export type MetricStatus = 'on-track' | 'slightly-behind' | 'behind'
export type OnTrackTier = 'on-track' | 'slightly-behind' | 'behind'

const ADHERENCE_ON_TRACK_THRESHOLD_PERCENT = 80
const LONG_RUN_BAND_RATIO = 0.1
const LONG_RUN_ON_TRACK_FRACTION = 0.5

/** Trailing-4-week plan adherence, reduced to a two-state metric (no middle
 *  ground defined for this input in the on-track model). */
export function classifyAdherence(adherence4wkPercent: number): MetricStatus {
  return adherence4wkPercent >= ADHERENCE_ON_TRACK_THRESHOLD_PERCENT ? 'on-track' : 'behind'
}

/** Fraction of the most recent long runs whose actual distance fell within
 *  +/-10% of that week's planned distance. Undefined when no long-run
 *  sessions have occurred yet (nothing to judge). */
export function computeLongRunProgressionRatio(
  sessions: Session[],
  runs: Run[],
  today: string,
  lookbackCount = 4,
): number | undefined {
  const longSessions = sessions
    .filter((s) => (s.type === 'long' || s.type === 'race') && s.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, lookbackCount)
  if (longSessions.length === 0) return undefined

  const withinBand = longSessions.filter((session) => {
    const run = findRunForSession(session, runs)
    if (!run || session.plannedDistanceKm <= 0) return false
    const ratio = run.distanceKm / session.plannedDistanceKm
    return ratio >= 1 - LONG_RUN_BAND_RATIO && ratio <= 1 + LONG_RUN_BAND_RATIO
  })
  return withinBand.length / longSessions.length
}

export function classifyLongRunProgression(withinBandRatio: number | undefined): MetricStatus {
  if (withinBandRatio === undefined) return 'on-track' // no data yet — don't flag as behind
  return withinBandRatio >= LONG_RUN_ON_TRACK_FRACTION ? 'on-track' : 'behind'
}

/** Where the goal time falls relative to the predicted marathon range:
 *  at/below the low end = on track, between low/high = slightly behind,
 *  above the high end = behind. */
export function classifyMarathonGoal(
  goalSeconds: number,
  marathonLowSeconds: number,
  marathonHighSeconds: number,
): MetricStatus {
  if (goalSeconds <= marathonLowSeconds) return 'on-track'
  if (goalSeconds <= marathonHighSeconds) return 'slightly-behind'
  return 'behind'
}

export interface OnTrackInputs {
  adherence4wk: MetricStatus
  longRunProgression: MetricStatus
  marathonRangeVsGoal: MetricStatus
}

/** Combines the three raw inputs into a single qualitative tier — no
 *  percentages or confidence claims, just how many of the three signals
 *  are not on track. */
export function computeOnTrackStatus(inputs: OnTrackInputs): OnTrackTier {
  const notOnTrackCount = Object.values(inputs).filter((status) => status !== 'on-track').length
  if (notOnTrackCount === 0) return 'on-track'
  if (notOnTrackCount === 1) return 'slightly-behind'
  return 'behind'
}

// --- Acute:chronic workload ratio -------------------------------------------

export type ACWRBand = 'steady' | 'ramping' | 'spike'

const ACWR_TRAILING_WEEKS = 4
const ACWR_STEADY_MAX = 1.3
const ACWR_RAMPING_MAX = 1.5

/** This week's total km divided by the trailing 4-week average. Expects
 *  `weeklyDistancesKm` in ascending chronological order with the current
 *  week last. Undefined when there isn't a full trailing window yet, or the
 *  trailing average is zero (avoids a divide-by-zero / meaningless ratio). */
export function computeACWR(weeklyDistancesKm: number[]): number | undefined {
  if (weeklyDistancesKm.length < ACWR_TRAILING_WEEKS + 1) return undefined
  const current = weeklyDistancesKm[weeklyDistancesKm.length - 1]
  const trailing = weeklyDistancesKm.slice(-(ACWR_TRAILING_WEEKS + 1), -1)
  const avg = trailing.reduce((sum, km) => sum + km, 0) / trailing.length
  if (avg === 0) return undefined
  return current / avg
}

export function classifyACWR(acwr: number): ACWRBand {
  if (acwr <= ACWR_STEADY_MAX) return 'steady'
  if (acwr <= ACWR_RAMPING_MAX) return 'ramping'
  return 'spike'
}

/** True when the ACWR chip should be hidden: too little history to trust the
 *  ratio, or the current week is intentionally reduced (cutback/holiday). */
export function shouldSuppressACWR(weeklyDistancesCount: number, currentWeek: WeekMeta | undefined): boolean {
  if (weeklyDistancesCount < ACWR_TRAILING_WEEKS + 1) return true
  if (currentWeek?.isCutback || currentWeek?.isHolidayMaintenance) return true
  return false
}

// --- Personal records --------------------------------------------------------

export interface PersonalRecord {
  bestPaceSecPerKm: number
  bestTimeSeconds: number
  distanceKm: number
  date: string
}

export interface PersonalRecords {
  fiveKPlus?: PersonalRecord
  tenKPlus?: PersonalRecord
  longestRun?: { distanceKm: number; date: string }
}

/** Best pace/time at >=5km and >=10km, plus the single longest run ever —
 *  each recomputed from full history every call, so a record only "updates"
 *  in the sense that it's naturally re-derived, never mutated in place. */
export function computePersonalRecords(runs: Run[]): PersonalRecords {
  function bestAtDistance(minKm: number): PersonalRecord | undefined {
    const eligible = runs.filter((r) => r.distanceKm >= minKm && r.paceSecPerKm > 0)
    if (eligible.length === 0) return undefined
    const best = eligible.reduce((a, b) => (b.paceSecPerKm < a.paceSecPerKm ? b : a))
    return {
      bestPaceSecPerKm: best.paceSecPerKm,
      bestTimeSeconds: best.durationSeconds,
      distanceKm: best.distanceKm,
      date: best.date,
    }
  }

  const longestRun = runs.reduce<Run | undefined>(
    (longest, r) => (!longest || r.distanceKm > longest.distanceKm ? r : longest),
    undefined,
  )

  return {
    fiveKPlus: bestAtDistance(5),
    tenKPlus: bestAtDistance(10),
    longestRun: longestRun ? { distanceKm: longestRun.distanceKm, date: longestRun.date } : undefined,
  }
}
