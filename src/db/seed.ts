// Generates the concrete 36-week plan from the WEEK_PLAN seed data and
// handles initial database seeding.

import { db } from './db'
import { WEEK_PLAN, PHASE_LABELS } from './weekPlan'
import { addDays } from '../lib/dates'
import { DEFAULT_GOAL_SECONDS } from '../lib/paceZones'
import { generateStrengthSessions } from '../lib/strengthSchedule'
import type { Session, WeekMeta } from '../types'

export const RACE_DATE = '2027-04-25'
export const PLAN_START_DATE = '2026-08-17'

export function weekStartDate(week: number): string {
  return addDays(PLAN_START_DATE, (week - 1) * 7)
}

function computeIsTaper(week: number): boolean {
  return week >= 34
}

/** Builds the full set of Session and WeekMeta records from the static plan. */
export function generatePlan(): { sessions: Session[]; weeks: WeekMeta[] } {
  const sessions: Session[] = []
  const weeks: WeekMeta[] = []

  for (const weekSeed of WEEK_PLAN) {
    const startDate = weekStartDate(weekSeed.week)

    weeks.push({
      week: weekSeed.week,
      startDate,
      phase: weekSeed.phase,
      phaseLabel: PHASE_LABELS[weekSeed.phase],
      targetVolumeKm: weekSeed.targetVolumeKm,
      isCutback: weekSeed.isCutback ?? false,
      isHolidayMaintenance: weekSeed.isHolidayMaintenance ?? false,
      isHalfMarathonWeek: weekSeed.isHalfMarathonWeek ?? false,
      isRaceWeek: weekSeed.isRaceWeek ?? false,
      isTaper: computeIsTaper(weekSeed.week),
    })

    for (const sessionSeed of weekSeed.sessions) {
      sessions.push({
        id: crypto.randomUUID(),
        week: weekSeed.week,
        date: addDays(startDate, sessionSeed.dayOffset),
        type: sessionSeed.type,
        plannedDistanceKm: sessionSeed.distanceKm,
        description: sessionSeed.description,
        status: 'planned',
      })
    }
  }

  return { sessions, weeks }
}

/** Seeds the database with the default plan, goal, and settings if empty. */
export async function seedDatabaseIfEmpty(): Promise<void> {
  await db.transaction('rw', db.sessions, db.weeks, db.goals, db.settings, async () => {
    const [sessionCount, goalCount, settingsCount] = await Promise.all([
      db.sessions.count(),
      db.goals.count(),
      db.settings.count(),
    ])

    if (sessionCount === 0) {
      const { sessions, weeks } = generatePlan()
      await db.sessions.bulkAdd([...sessions, ...generateStrengthSessions()])
      await db.weeks.bulkAdd(weeks)
    }

    if (goalCount === 0) {
      await db.goals.add({
        id: 'goal',
        targetTimeSeconds: DEFAULT_GOAL_SECONDS,
        updatedAt: new Date().toISOString(),
      })
    }

    if (settingsCount === 0) {
      await db.settings.add({
        id: 'settings',
        preferredDays: [2, 4, 6, 0], // Tue, Thu, Sat, Sun (JS Date#getDay() convention)
        units: 'km',
        hasRequestedPersistence: false,
        theme: 'system',
      })
    }
  })
}

/** Clears and re-seeds the plan (sessions + weeks) from the original static plan. */
export async function resetToOriginalPlan(): Promise<void> {
  await db.transaction('rw', db.sessions, db.weeks, async () => {
    await db.sessions.clear()
    await db.weeks.clear()
    const { sessions, weeks } = generatePlan()
    await db.sessions.bulkAdd([...sessions, ...generateStrengthSessions()])
    await db.weeks.bulkAdd(weeks)
  })
}
