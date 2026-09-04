// Deterministic, local recovery guidance — no external services, no data stored
// beyond what's already persisted on Run/Session (loggedAt / completedAt).

import { addDays, daysBetween } from './dates'
import type { Run, Session, SessionType } from '../types'

export type ActivityLoadLevel = 'light' | 'moderate' | 'hard'

/** A recent training activity, normalized from either a Run or a completed strength Session. */
export interface ActivitySource {
  type: SessionType | 'other'
  /** ISO date, YYYY-MM-DD */
  date: string
  durationMinutes: number
  distanceKm?: number
  plannedDistanceKm?: number
  /** Perceived effort, 1-10 */
  effort?: number
  /** ISO datetime the activity actually happened, if known. */
  timestamp?: string
  /** True when `timestamp` (or the 09:00 fallback) is a guess, not a real logged time. */
  assumedTime: boolean
}

const EASY_LONG_THRESHOLD_MINUTES = 45
const EFFORT_ESCALATION_THRESHOLD = 8
const DISTANCE_OVERAGE_ESCALATION_RATIO = 1.2
const REFUEL_WINDOW_MINUTES = 120
const RECENCY_LOOKBACK_DAYS = 3

export function runToActivity(run: Run, plannedDistanceKm?: number): ActivitySource {
  return {
    type: run.type,
    date: run.date,
    durationMinutes: run.durationSeconds / 60,
    distanceKm: run.distanceKm,
    plannedDistanceKm,
    effort: run.effort,
    timestamp: run.loggedAt,
    assumedTime: !run.loggedAt,
  }
}

export function strengthSessionToActivity(session: Session): ActivitySource {
  return {
    type: 'strength',
    date: session.date,
    durationMinutes: session.estimatedMinutes ?? 25,
    timestamp: session.completedAt,
    assumedTime: !session.completedAt,
  }
}

function bumpLevel(level: ActivityLoadLevel): ActivityLoadLevel {
  return level === 'light' ? 'moderate' : 'hard'
}

export interface ActivityLoad {
  level: ActivityLoadLevel
  qualityWaitHours: number
  reasoning: string
}

/** Per-activity-type base load, then bumped up a band for a very hard effort or a run well over its planned distance. */
export function computeActivityLoad(activity: ActivitySource): ActivityLoad {
  let level: ActivityLoadLevel
  let qualityWaitHours: number
  let reasoning: string

  switch (activity.type) {
    case 'easy':
    case 'strides':
      if (activity.durationMinutes < EASY_LONG_THRESHOLD_MINUTES) {
        level = 'light'
        qualityWaitHours = 0
        reasoning = 'Easy run under 45 minutes — light load.'
      } else {
        level = 'moderate'
        qualityWaitHours = 24
        reasoning = 'Easy run of 45+ minutes — moderate load, allow 24h before quality work.'
      }
      break
    case 'tempo':
    case 'marathon-pace':
    case 'race':
      level = 'hard'
      qualityWaitHours = 48
      reasoning = 'Quality effort — hard load, allow 48h before another hard session.'
      break
    case 'long':
      level = 'hard'
      qualityWaitHours = 48
      reasoning = 'Long run — hard load, allow 48h before another hard session.'
      break
    case 'strength':
      level = 'hard'
      qualityWaitHours = 48
      reasoning = 'Strength session — hard load for the muscle groups worked, allow 48h (the A/B split already spaces these out).'
      break
    case 'rest':
    case 'other':
      level = 'light'
      qualityWaitHours = 0
      reasoning = 'Light activity.'
      break
  }

  const distanceRatio =
    activity.plannedDistanceKm && activity.distanceKm ? activity.distanceKm / activity.plannedDistanceKm : undefined
  const highEffort = activity.effort !== undefined && activity.effort >= EFFORT_ESCALATION_THRESHOLD
  const overDistance = distanceRatio !== undefined && distanceRatio > DISTANCE_OVERAGE_ESCALATION_RATIO

  if ((highEffort || overDistance) && level !== 'hard') {
    level = bumpLevel(level)
    qualityWaitHours = level === 'hard' ? 48 : 24
    const reasons = [highEffort && `effort was ${activity.effort}/10`, overDistance && 'distance ran 20%+ over planned']
      .filter(Boolean)
      .join(' and ')
    reasoning = `${reasoning} Bumped up because ${reasons}.`
  }

  return { level, qualityWaitHours, reasoning }
}

export type RecoveryBand = 'recovered' | 'recovering' | 'recently-worked'

export interface RecoveryState {
  band: RecoveryBand
  reasoning: string
  nextQualityDate?: string
}

/** Ranks activities by hardness then recency to find the one currently driving recovery guidance. */
function findDrivingActivity(activities: ActivitySource[], today: string) {
  const rank: Record<ActivityLoadLevel, number> = { light: 0, moderate: 1, hard: 2 }
  const withLoad = activities
    .filter((a) => a.date <= today && daysBetween(a.date, today) <= RECENCY_LOOKBACK_DAYS)
    .map((activity) => ({ activity, load: computeActivityLoad(activity) }))

  return withLoad.reduce<{ activity: ActivitySource; load: ActivityLoad } | undefined>((best, current) => {
    if (!best) return current
    if (rank[current.load.level] !== rank[best.load.level]) {
      return rank[current.load.level] > rank[best.load.level] ? current : best
    }
    return current.activity.date > best.activity.date ? current : best
  }, undefined)
}

/**
 * Defers to the plan: only escalates caution when yesterday's *logged* effort came in
 * harder than what was actually planned for that day. Otherwise, if today has a
 * scheduled (non-rest) session, guidance is softened to "keep it genuinely easy"
 * rather than contradicting the plan.
 */
export function computeRecoveryState(
  recentActivities: ActivitySource[],
  today: string,
  todaysScheduledSession?: Session,
): RecoveryState {
  const driving = findDrivingActivity(recentActivities, today)

  if (!driving || driving.load.level === 'light') {
    return { band: 'recovered', reasoning: 'No recent hard efforts logged — you\'re recovered.' }
  }

  const { activity, load } = driving
  const daysSince = daysBetween(activity.date, today)
  const waitDays = Math.ceil(load.qualityWaitHours / 24)
  const nextQualityDate = waitDays > 0 ? addDays(activity.date, waitDays) : undefined

  let band: RecoveryBand = 'recovered'
  if (daysSince === 0) band = 'recently-worked'
  else if (daysSince < waitDays) band = 'recovering'

  let reasoning =
    band === 'recovered'
      ? `Recovered from your last ${load.level} effort — good to go.`
      : load.reasoning

  const yesterday = addDays(today, -1)
  const wasHarderThanPlanned =
    activity.date === yesterday &&
    activity.plannedDistanceKm !== undefined &&
    activity.distanceKm !== undefined &&
    activity.distanceKm > activity.plannedDistanceKm * DISTANCE_OVERAGE_ESCALATION_RATIO

  if (band !== 'recovered' && todaysScheduledSession && todaysScheduledSession.type !== 'rest' && !wasHarderThanPlanned) {
    band = 'recovering'
    reasoning = `Today's ${todaysScheduledSession.type} run is on plan — keep it genuinely easy and you'll be fine.`
  }

  return { band, reasoning, nextQualityDate }
}

export interface RefuelPrompt {
  active: boolean
  minutesRemaining: number
}

function isRefuelEligible(activity: ActivitySource): boolean {
  if (activity.type === 'strength') return true
  const runTypes: (SessionType | 'other')[] = ['easy', 'long', 'tempo', 'marathon-pace', 'race', 'strides']
  return runTypes.includes(activity.type) && activity.durationMinutes >= EASY_LONG_THRESHOLD_MINUTES
}

/** True only for activities with a real (non-assumed) timestamp within the last 2 hours. */
export function computeRefuelPrompt(recentActivities: ActivitySource[], now: Date): RefuelPrompt {
  let minutesRemaining = 0
  for (const activity of recentActivities) {
    if (activity.assumedTime || !activity.timestamp || !isRefuelEligible(activity)) continue
    const elapsedMinutes = (now.getTime() - new Date(activity.timestamp).getTime()) / 60_000
    if (elapsedMinutes >= 0 && elapsedMinutes < REFUEL_WINDOW_MINUTES) {
      minutesRemaining = Math.max(minutesRemaining, REFUEL_WINDOW_MINUTES - elapsedMinutes)
    }
  }
  return { active: minutesRemaining > 0, minutesRemaining: Math.round(minutesRemaining) }
}
