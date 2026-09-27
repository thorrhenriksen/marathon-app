// Pure helpers for the Train tab's paged Week agenda: which week is
// "current", paging bounds, swipe classification, and per-week planned
// totals. Kept separate from WeekAgenda.tsx so the math can be unit-tested
// without mounting the component tree.

import type { PaceZones, Session, WeekMeta } from '../types'
import { estimateSessionDurationMinutes } from './paceZones'

/** The plan week containing `today`: the latest week starting on or before
 *  today, falling back to the first week before the plan starts. */
export function findCurrentWeekNumber(weeks: WeekMeta[], today: string): number | null {
  let current: WeekMeta | undefined
  for (const w of weeks) {
    if (w.startDate <= today && (!current || w.startDate > current.startDate)) current = w
  }
  return current?.week ?? weeks[0]?.week ?? null
}

export function clampWeek(week: number, minWeek: number, maxWeek: number): number {
  return Math.min(maxWeek, Math.max(minWeek, week))
}

const SWIPE_MIN_PX = 50

/** Classifies a completed touch gesture: a mostly-horizontal drag of at
 *  least SWIPE_MIN_PX pages the week (left = next, right = previous);
 *  anything else (vertical scrolls, taps) returns 0. */
export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN_PX) return 0
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? 1 : -1
}

/** Estimated minutes for one session: strength uses its stored estimate,
 *  runs use distance × the midpoint of the easy pace band. */
export function sessionEstimatedMinutes(session: Session, zones: PaceZones): number {
  if (session.type === 'rest') return 0
  if (session.type === 'strength') return session.estimatedMinutes ?? 0
  return estimateSessionDurationMinutes(session.plannedDistanceKm, zones)
}

export interface WeekTotals {
  totalKm: number
  totalMinutes: number
}

/** Sums planned distance and estimated duration across a week's non-rest sessions. */
export function computeWeekTotals(sessions: Session[], zones: PaceZones): WeekTotals {
  const trackable = sessions.filter((s) => s.type !== 'rest')
  return {
    totalKm: trackable.reduce((sum, s) => sum + s.plannedDistanceKm, 0),
    totalMinutes: trackable.reduce((sum, s) => sum + sessionEstimatedMinutes(s, zones), 0),
  }
}
