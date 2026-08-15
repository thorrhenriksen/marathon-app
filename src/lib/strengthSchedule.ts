// Generates the full 36-week strength/mobility session schedule, mirroring
// the shape/conventions of generatePlan() in src/db/seed.ts.

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
import type { Session, StrengthVariant } from '../types'

const MONDAY_OFFSET = 0
const WEDNESDAY_OFFSET = 2
const SUNDAY_OFFSET = 6
const MARATHON_BLOCK_START_WEEK = 21
const TAPER_START_WEEK = 34
const RACE_WEEK = 36
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
