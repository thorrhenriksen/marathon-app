// Thin Dexie I/O wrapper around the pure helpers in src/lib/adjustmentPersistence.ts.
// Treats "undo an adjustment" and "remove a time-off entry" as the same operation:
// both fully reverse the sessions and delete the time-off + adjustment records.

import { db } from './db'
import { buildTimeOffAdjustmentRecord } from '../lib/adjustmentPersistence'
import type { AdjustmentPreview } from '../lib/adjustmentEngine'
import type { Session, TimeOff, TimeOffAdjustment } from '../types'

/** Persists a newly-applied time-off adjustment: writes the updated/inserted
 *  sessions, the TimeOff entry, and a TimeOffAdjustment record for later undo. */
export async function applyTimeOff(
  timeOff: TimeOff,
  preview: AdjustmentPreview,
  previousSessions: Session[],
): Promise<void> {
  const record = buildTimeOffAdjustmentRecord(timeOff, preview, previousSessions)

  await db.transaction('rw', db.sessions, db.timeOff, db.timeOffAdjustments, async () => {
    if (preview.updatedSessions.length > 0) {
      await db.sessions.bulkPut(preview.updatedSessions)
    }
    if (preview.insertedSessions.length > 0) {
      await db.sessions.bulkAdd(preview.insertedSessions)
    }
    await db.timeOff.add(timeOff)
    await db.timeOffAdjustments.add(record)
  })
}

/** Reverses every adjustment tied to a time-off entry, restoring the affected
 *  sessions, removing any inserted sessions, and deleting the time-off entry. */
export async function reverseTimeOff(timeOffId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.timeOff, db.timeOffAdjustments, async () => {
    const adjustments = await db.timeOffAdjustments.where('timeOffId').equals(timeOffId).toArray()

    for (const adjustment of adjustments) {
      if (adjustment.previousSessions.length > 0) {
        await db.sessions.bulkPut(adjustment.previousSessions)
      }
      if (adjustment.insertedSessionIds.length > 0) {
        await db.sessions.bulkDelete(adjustment.insertedSessionIds)
      }
    }

    await db.timeOffAdjustments.where('timeOffId').equals(timeOffId).delete()
    await db.timeOff.delete(timeOffId)
  })
}

/** Looks up every non-undone adjustment affecting any of the given weeks. */
export async function getAdjustmentsForWeeks(weeks: number[]): Promise<TimeOffAdjustment[]> {
  if (weeks.length === 0) return []
  const results = await db.timeOffAdjustments.where('affectedWeeks').anyOf(weeks).toArray()
  return results.filter((a) => !a.undone)
}
