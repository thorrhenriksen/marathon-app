// Pure reconciliation for moving an existing plan onto the six-block
// strength periodization. Only strength sessions that are still untouched
// plans for today or later (status 'planned', week ≥ 6) are replaced;
// anything with an outcome — completed, missed, adjusted, moved, skipped for
// time off, downgraded — and every past session is left exactly as it is.

import { PERIODIZATION_START_WEEK } from './strengthBlocks'
import type { Session } from '../types'

export interface StrengthReconciliation {
  deleteIds: string[]
  add: Session[]
}

/** `protectedIds`: sessions referenced by an active time-off adjustment
 *  (re-entry inserts or undo snapshots) — kept so undoing that holiday still
 *  restores exactly what it recorded. */
export function reconcileStrengthPlan(
  existing: Session[],
  generated: Session[],
  today: string,
  protectedIds: Set<string> = new Set(),
): StrengthReconciliation {
  const strength = existing.filter((s) => s.type === 'strength')
  const replaceable = strength.filter(
    (s) => s.week >= PERIODIZATION_START_WEEK && s.status === 'planned' && s.date >= today && !protectedIds.has(s.id),
  )
  const replaceableIds = new Set(replaceable.map((s) => s.id))
  const kept = strength.filter((s) => !replaceableIds.has(s.id))
  // A kept session occupies its original slot (moved sessions keep their
  // originalDate), so the generator never double-books that day.
  const occupied = new Set(kept.map((s) => `${s.week}|${s.originalDate ?? s.date}`))

  const add = generated.filter(
    (g) =>
      g.week >= PERIODIZATION_START_WEEK &&
      g.date >= today &&
      !occupied.has(`${g.week}|${g.date}`),
  )
  return { deleteIds: [...replaceableIds], add }
}
