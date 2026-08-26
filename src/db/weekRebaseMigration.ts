// One-off migration: rebases the plan from the original 36-week schedule
// (starting Monday 2026-08-17) to the current 35-week schedule (starting
// Monday 2026-08-24), reflecting that the user was on holiday during the
// original week 1 and effectively started training a week late.
//
// Deletes the old week 1, reverses its associated time-off adjustment, and
// renumbers every surviving week/session/adjustment down by one. Idempotent:
// safe to call on every app load. No-ops on fresh installs, which already
// seed directly from the updated 35-week static data.
//
// The idempotency guard and every mutation run inside a single Dexie
// transaction, so concurrent invocations (e.g. React StrictMode's dev-mode
// double effect, or multiple open tabs) serialize instead of racing: the
// second invocation's guard check only runs after the first has committed,
// at which point it correctly observes the migrated state and no-ops.

import { db } from './db'
import { reverseTimeOff } from './timeOffAdjustments'

const LEGACY_WEEK_ONE_START_DATE = '2026-08-17'
const LEGACY_WEEK_ONE_END_DATE = '2026-08-23'

export async function runWeekRebaseMigration(): Promise<void> {
  await db.transaction(
    'rw',
    db.sessions,
    db.weeks,
    db.timeOff,
    db.timeOffAdjustments,
    async () => {
      const legacyWeekOne = await db.weeks.get(1)
      if (!legacyWeekOne || legacyWeekOne.startDate !== LEGACY_WEEK_ONE_START_DATE) return

      // Step 1 — reverse any time-off adjustment overlapping the old week 1.
      const timeOffEntries = await db.timeOff.toArray()
      for (const timeOff of timeOffEntries) {
        const overlapsWeekOne =
          timeOff.startDate <= LEGACY_WEEK_ONE_END_DATE && timeOff.endDate >= LEGACY_WEEK_ONE_START_DATE
        if (overlapsWeekOne) {
          await reverseTimeOff(timeOff.id)
        }
      }

      // Step 2 — delete week 1.
      await db.sessions.where('week').equals(1).delete()
      await db.weeks.delete(1)

      // Step 3 — renumber survivors down by one.
      const remainingSessions = await db.sessions.where('week').above(1).toArray()
      if (remainingSessions.length > 0) {
        await db.sessions.bulkPut(remainingSessions.map((s) => ({ ...s, week: s.week - 1 })))
      }

      const remainingWeeks = await db.weeks.toArray()
      await db.weeks.clear()
      if (remainingWeeks.length > 0) {
        await db.weeks.bulkAdd(remainingWeeks.map((w) => ({ ...w, week: w.week - 1 })))
      }

      // Step 4 — keep surviving TimeOffAdjustment records internally consistent.
      const remainingAdjustments = await db.timeOffAdjustments.toArray()
      for (const adjustment of remainingAdjustments) {
        await db.timeOffAdjustments.put({
          ...adjustment,
          affectedWeeks: adjustment.affectedWeeks.map((w) => (w > 1 ? w - 1 : w)),
          previousSessions: adjustment.previousSessions.map((s) => (s.week > 1 ? { ...s, week: s.week - 1 } : s)),
          returnWeekNumber:
            adjustment.returnWeekNumber !== undefined && adjustment.returnWeekNumber > 1
              ? adjustment.returnWeekNumber - 1
              : adjustment.returnWeekNumber,
          reEntryTemplateWeek:
            adjustment.reEntryTemplateWeek !== undefined && adjustment.reEntryTemplateWeek > 1
              ? adjustment.reEntryTemplateWeek - 1
              : adjustment.reEntryTemplateWeek,
        })
      }
    },
  )
}
