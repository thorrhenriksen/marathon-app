// Pure helpers for the Train tab's Week agenda: windowed rendering (so we
// never mount all 35 weeks at once) and per-week planned totals. Kept
// separate from WeekAgenda.tsx so the windowing math and aggregation can be
// unit-tested without mounting the component tree.

import type { PaceZones, Session, WeekMeta } from '../types'
import { estimateSessionDurationMinutes } from './paceZones'

export interface WeekWindow {
  start: number
  end: number
}

const WINDOW_RADIUS = 4
const WINDOW_EXPAND = 4

/** Centers the initial window on the current week, +/- WINDOW_RADIUS weeks, clamped to the available range. */
export function initialWeekWindow(currentWeek: number, minWeek: number, maxWeek: number): WeekWindow {
  return {
    start: Math.max(minWeek, currentWeek - WINDOW_RADIUS),
    end: Math.min(maxWeek, currentWeek + WINDOW_RADIUS),
  }
}

/** Grows the window backwards by WINDOW_EXPAND weeks, clamped at minWeek. */
export function expandWindowStart(window: WeekWindow, minWeek: number): WeekWindow {
  return { ...window, start: Math.max(minWeek, window.start - WINDOW_EXPAND) }
}

/** Grows the window forwards by WINDOW_EXPAND weeks, clamped at maxWeek. */
export function expandWindowEnd(window: WeekWindow, maxWeek: number): WeekWindow {
  return { ...window, end: Math.min(maxWeek, window.end + WINDOW_EXPAND) }
}

export function weeksInWindow(weeks: WeekMeta[], window: WeekWindow): WeekMeta[] {
  return weeks.filter((w) => w.week >= window.start && w.week <= window.end)
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
    totalMinutes: trackable.reduce(
      (sum, s) => sum + estimateSessionDurationMinutes(s.plannedDistanceKm, zones),
      0,
    ),
  }
}
