import { describe, it, expect } from 'vitest'
import {
  initialWeekWindow,
  expandWindowStart,
  expandWindowEnd,
  weeksInWindow,
  computeWeekTotals,
} from './weekAgenda'
import { computePaceZones } from './paceZones'
import type { Session, WeekMeta } from '../types'

function makeWeek(week: number): WeekMeta {
  return {
    week,
    startDate: '2026-08-24',
    phase: 1,
    phaseLabel: 'Base building',
    targetVolumeKm: 20,
    isCutback: false,
    isHolidayMaintenance: false,
    isHalfMarathonWeek: false,
    isRaceWeek: false,
    isTaper: false,
  }
}

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: 's1',
    week: 1,
    date: '2026-08-25',
    type: 'easy',
    plannedDistanceKm: 5,
    description: 'Easy run',
    status: 'planned',
    ...overrides,
  }
}

describe('initialWeekWindow', () => {
  it('centers on the current week +/- 4 weeks', () => {
    expect(initialWeekWindow(10, 1, 35)).toEqual({ start: 6, end: 14 })
  })

  it('clamps to the available week range', () => {
    expect(initialWeekWindow(2, 1, 35)).toEqual({ start: 1, end: 6 })
    expect(initialWeekWindow(34, 1, 35)).toEqual({ start: 30, end: 35 })
  })
})

describe('expandWindowStart / expandWindowEnd', () => {
  it('grows the window by 4 weeks in each direction', () => {
    expect(expandWindowStart({ start: 10, end: 14 }, 1)).toEqual({ start: 6, end: 14 })
    expect(expandWindowEnd({ start: 10, end: 14 }, 35)).toEqual({ start: 10, end: 18 })
  })

  it('clamps at the min/max week bounds', () => {
    expect(expandWindowStart({ start: 2, end: 14 }, 1)).toEqual({ start: 1, end: 14 })
    expect(expandWindowEnd({ start: 10, end: 33 }, 35)).toEqual({ start: 10, end: 35 })
  })
})

describe('weeksInWindow', () => {
  it('filters weeks to the inclusive window range', () => {
    const weeks = [makeWeek(1), makeWeek(2), makeWeek(3), makeWeek(4)]
    expect(weeksInWindow(weeks, { start: 2, end: 3 }).map((w) => w.week)).toEqual([2, 3])
  })
})

describe('computeWeekTotals', () => {
  const zones = computePaceZones(4 * 3600 + 30 * 60)

  it('sums planned distance across non-rest sessions', () => {
    const sessions = [
      makeSession({ id: 's1', plannedDistanceKm: 5 }),
      makeSession({ id: 's2', plannedDistanceKm: 8 }),
      makeSession({ id: 's3', type: 'rest', plannedDistanceKm: 0 }),
    ]
    const totals = computeWeekTotals(sessions, zones)
    expect(totals.totalKm).toBe(13)
    expect(totals.totalMinutes).toBeGreaterThan(0)
  })

  it('returns zero totals for an all-rest week', () => {
    const sessions = [makeSession({ id: 's1', type: 'rest', plannedDistanceKm: 0 })]
    const totals = computeWeekTotals(sessions, zones)
    expect(totals).toEqual({ totalKm: 0, totalMinutes: 0 })
  })
})
