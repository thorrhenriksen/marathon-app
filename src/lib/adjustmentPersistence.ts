// Pure helpers for turning an in-memory AdjustmentPreview into a persisted
// TimeOffAdjustment record, and for describing what reversing one will do.
// No Dexie/DB access here — see src/db/timeOffAdjustments.ts for the I/O layer.

import type { AdjustmentPreview } from './adjustmentEngine'
import type { Session, TimeOff, TimeOffAdjustment } from '../types'

/** Builds the persisted record for a just-applied time-off adjustment.
 *  `previousSessions` must be the pre-adjustment versions of exactly the
 *  sessions referenced in `preview.updatedSessions` (by id) — these are what
 *  gets restored on undo. */
export function buildTimeOffAdjustmentRecord(
  timeOff: TimeOff,
  preview: AdjustmentPreview,
  previousSessions: Session[],
): TimeOffAdjustment {
  const affectedWeeks = new Set<number>()
  for (const session of previousSessions) affectedWeeks.add(session.week)
  for (const session of preview.insertedSessions) affectedWeeks.add(session.week)

  return {
    id: crypto.randomUUID(),
    timeOffId: timeOff.id,
    createdAt: new Date().toISOString(),
    summary: preview.summary,
    affectedWeeks: Array.from(affectedWeeks).sort((a, b) => a - b),
    previousSessions,
    insertedSessionIds: preview.insertedSessions.map((s) => s.id),
    returnWeekNumber: preview.returnWeekNumber,
    reEntryTemplateWeek: preview.reEntryTemplateWeek,
    undone: false,
  }
}

/** Human-readable description of what undoing/removing this adjustment will do. */
export function previewReversal(adjustment: TimeOffAdjustment): string[] {
  const lines: string[] = []

  if (adjustment.previousSessions.length > 0) {
    const count = adjustment.previousSessions.length
    lines.push(`Restore ${count} session${count === 1 ? '' : 's'} to their original date and status`)
  }

  if (adjustment.insertedSessionIds.length > 0) {
    const count = adjustment.insertedSessionIds.length
    lines.push(`Remove ${count} inserted re-entry session${count === 1 ? '' : 's'}`)
  }

  if (adjustment.affectedWeeks.length > 0) {
    const weeksLabel =
      adjustment.affectedWeeks.length === 1
        ? `week ${adjustment.affectedWeeks[0]}`
        : `weeks ${adjustment.affectedWeeks.join(', ')}`
    lines.push(`Affects ${weeksLabel}`)
  }

  lines.push('Delete this time-off entry')

  return lines
}
