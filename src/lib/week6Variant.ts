// One-off, user-requested plan change: this week's (plan week 6, starting
// Mon 2026-09-28) Monday and Wednesday strength sessions switch to the
// "sore knees + toe" variant, kept as planned sessions. Nothing else changes.

import { applyInjuryVariant } from './injuryVariants'
import { addDays } from './dates'
import type { Session, WeekMeta } from '../types'

export const WEEK6_VARIANT_WEEK = 6

/** Sessions to update. Only untouched plans (status 'planned', no variant yet)
 *  on that week's Monday/Wednesday are converted; the change is skipped once
 *  the week is over. */
export function week6VariantUpdates(sessions: Session[], weeks: WeekMeta[], today: string): Session[] {
  const week = weeks.find((w) => w.week === WEEK6_VARIANT_WEEK)
  if (!week || today > addDays(week.startDate, 6)) return []
  const targetDates = new Set([week.startDate, addDays(week.startDate, 2)])
  return sessions
    .filter(
      (s) =>
        s.type === 'strength' &&
        s.week === WEEK6_VARIANT_WEEK &&
        s.status === 'planned' &&
        !s.injuryVariant &&
        targetDates.has(s.date),
    )
    // Applied as a plan, not an outcome: pass a "today" before the session so
    // the status stays 'planned' even for today's Monday session.
    .map((s) => applyInjuryVariant(s, 'sore-knees-toe', addDays(s.date, -1)))
}
