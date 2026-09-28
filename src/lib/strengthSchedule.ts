// Generates the full 35-week strength/mobility session schedule, mirroring
// the shape/conventions of generatePlan() in src/db/seed.ts. Weeks 1–5 keep
// the original A/B tiered sessions (already history for the current plan);
// weeks 6–35 come from the six-block periodization engine (strengthBlocks.ts).

import { addDays } from './dates'
import { weekStartDate } from '../db/seed'
import { WEEK_PLAN } from '../db/weekPlan'
import {
  buildMobilityOnlyExercises,
  buildSessionExercises,
  estimatedMinutesForTier,
  MOBILITY_ONLY_ESTIMATED_MINUTES,
  tierForWeek,
  type StrengthTier,
} from './strengthCatalog'
import { buildStrengthSessionsForWeek, PERIODIZATION_START_WEEK, type StrengthWeekContext } from './strengthBlocks'
import { GATE_10K_WEEKS, GATE_HALF_WEEKS } from './goalEngine'
import type { Session, StrengthVariant } from '../types'

const MONDAY_OFFSET = 0
const WEDNESDAY_OFFSET = 2
const SUNDAY_OFFSET = 6
const MARATHON_BLOCK_START_WEEK = 20
const TAPER_START_WEEK = 33
const RACE_WEEK = 35
const LONG_RUN_DOWNGRADE_THRESHOLD_KM = 26

function findWeekSeed(week: number) {
  return WEEK_PLAN.find((w) => w.week === week)
}

/** Distance of the previous week's Sunday long/race run, if any. */
function previousSundayDistanceKm(week: number): number | undefined {
  const previous = findWeekSeed(week - 1)
  const sunday = previous?.sessions.find((s) => s.dayOffset === SUNDAY_OFFSET)
  if (!sunday || (sunday.type !== 'long' && sunday.type !== 'race')) return undefined
  return sunday.distanceKm
}

function inRange(week: number, [from, to]: [number, number]): boolean {
  return week >= from && week <= to
}

/** Running context the periodization engine needs for one week, from the static plan. */
export function strengthWeekContext(week: number): StrengthWeekContext {
  const seed = findWeekSeed(week)
  const weekStart = weekStartDate(week)
  const runs = (seed?.sessions ?? []).map((s) => ({
    week,
    date: addDays(weekStart, s.dayOffset),
    type: s.type,
    plannedDistanceKm: s.distanceKm,
  }))
  const hasRace = runs.some((r) => r.type === 'race')
  return {
    week,
    weekStart,
    isCutback: seed?.isCutback ?? false,
    isGateRaceWeek: hasRace && (inRange(week, GATE_10K_WEEKS) || inRange(week, GATE_HALF_WEEKS)),
    runs,
    previousSundayKm: previousSundayDistanceKm(week),
  }
}

export function generateStrengthSessions(): Session[] {
  const sessions: Session[] = []
  let nextVariant: StrengthVariant = 'A'

  function placeSession(
    week: number,
    dayOffset: number,
    tier: StrengthTier,
    options?: { mobilityOnly?: boolean; downgraded?: boolean },
  ): void {
    const variant = nextVariant
    nextVariant = variant === 'A' ? 'B' : 'A'
    const mobilityOnly = options?.mobilityOnly ?? false
    const downgraded = options?.downgraded ?? false

    // Defensive: a strength session must never fall the day before this
    // week's long/race run. True by construction (fixed Mon/Wed placement),
    // but guards against future weekPlan.ts changes.
    const weekSeed = findWeekSeed(week)
    const longOrRace = weekSeed?.sessions.find((s) => s.type === 'long' || s.type === 'race')
    if (longOrRace && dayOffset === longOrRace.dayOffset - 1) {
      throw new Error(`Strength session for week ${week} falls the day before the long/race run`)
    }

    const exercises = mobilityOnly ? buildMobilityOnlyExercises(variant) : buildSessionExercises(variant, tier)
    const estimatedMinutes = mobilityOnly ? MOBILITY_ONLY_ESTIMATED_MINUTES : estimatedMinutesForTier(tier)
    const description = mobilityOnly
      ? `Strength — Session ${variant} (mobility only)`
      : `Strength — Session ${variant}`

    sessions.push({
      id: crypto.randomUUID(),
      week,
      date: addDays(weekStartDate(week), dayOffset),
      type: 'strength',
      plannedDistanceKm: 0,
      description,
      status: downgraded ? 'downgraded-to-mobility' : 'planned',
      variant,
      exercises,
      estimatedMinutes,
    })
  }

  for (const weekSeed of WEEK_PLAN) {
    const { week } = weekSeed
    const tier = tierForWeek(week)

    if (week >= PERIODIZATION_START_WEEK) {
      sessions.push(...buildStrengthSessionsForWeek(strengthWeekContext(week)))
      continue
    }

    if (week === RACE_WEEK) {
      placeSession(week, MONDAY_OFFSET, tier, { mobilityOnly: true })
      continue
    }

    if (week >= TAPER_START_WEEK) {
      placeSession(week, MONDAY_OFFSET, tier)
      continue
    }

    const isReducedCutbackWeek = week >= MARATHON_BLOCK_START_WEEK && weekSeed.isCutback
    const mondayDowngraded = (previousSundayDistanceKm(week) ?? 0) >= LONG_RUN_DOWNGRADE_THRESHOLD_KM

    if (isReducedCutbackWeek) {
      placeSession(week, MONDAY_OFFSET, tier, { mobilityOnly: mondayDowngraded, downgraded: mondayDowngraded })
      continue
    }

    placeSession(week, MONDAY_OFFSET, tier, { mobilityOnly: mondayDowngraded, downgraded: mondayDowngraded })
    placeSession(week, WEDNESDAY_OFFSET, tier)
  }

  return sessions
}

/** The full (non-downgraded) planned version of a week's strength session,
 *  used when an outcome or injury variant is reverted. Undefined for weeks
 *  before the periodization, which keep the original tiered rebuild. */
export function rebuildPlannedStrength(
  week: number,
  variant: StrengthVariant | undefined,
): Pick<Session, 'description' | 'exercises' | 'estimatedMinutes' | 'strengthBlock'> | undefined {
  if (week < PERIODIZATION_START_WEEK) return undefined
  const ctx = { ...strengthWeekContext(week), previousSundayKm: undefined }
  const match = buildStrengthSessionsForWeek(ctx).find((s) => s.variant === variant)
  if (!match) return undefined
  return {
    description: match.description,
    exercises: match.exercises,
    estimatedMinutes: match.estimatedMinutes,
    strengthBlock: match.strengthBlock,
  }
}
