// Shared lookups for rendering time-off/adjustment info across Plan, Today,
// and the calendar-navigation components (Feature 3).

import { isDateInRange } from './dates'
import type { TimeOff, TimeOffAdjustment } from '../types'

export function findTimeOffForDate(date: string, timeOffEntries: TimeOff[]): TimeOff | undefined {
  return timeOffEntries.find((t) => isDateInRange(date, t.startDate, t.endDate))
}

export function getWeekAdjustments(week: number, adjustments: TimeOffAdjustment[]): TimeOffAdjustment[] {
  return adjustments.filter((a) => a.affectedWeeks.includes(week))
}
