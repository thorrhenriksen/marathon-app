import { describe, it, expect } from 'vitest'
import { findCurrentWeekNumber, clampWeek, swipeDirection, computeWeekTotals, sessionEstimatedMinutes } from './weekAgenda'
import { computePaceZones } from './paceZones'
import type { Session, WeekMeta } from '../types'

function makeWeek(week: number, startDate = '2026-08-24'): WeekMeta {
  return {
    week,
    startDate,
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

describe('findCurrentWeekNumber', () => {
  const weeks = [makeWeek(1, '2026-08-24'), makeWeek(2, '2026-08-31'), makeWeek(3, '2026-09-07')]

  it('picks the week containing today', () => {
    expect(findCurrentWeekNumber(weeks, '2026-09-02')).toBe(2)
    expect(findCurrentWeekNumber(weeks, '2026-08-31')).toBe(2)
  })

  it('falls back to the first week before the plan starts', () => {
    expect(findCurrentWeekNumber(weeks, '2026-08-01')).toBe(1)
  })

  it('returns null with no weeks', () => {
    expect(findCurrentWeekNumber([], '2026-08-01')).toBeNull()
  })
})

describe('clampWeek', () => {
  it('clamps to the plan range', () => {
    expect(clampWeek(0, 1, 35)).toBe(1)
    expect(clampWeek(36, 1, 35)).toBe(35)
    expect(clampWeek(10, 1, 35)).toBe(10)
  })
})

describe('swipeDirection', () => {
  it('pages forward on a left swipe and back on a right swipe', () => {
    expect(swipeDirection(-80, 5)).toBe(1)
    expect(swipeDirection(80, -5)).toBe(-1)
  })

  it('ignores short drags and mostly-vertical scrolls', () => {
    expect(swipeDirection(-30, 0)).toBe(0)
    expect(swipeDirection(-80, 70)).toBe(0)
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

  it('includes strength session estimates in total time', () => {
    const sessions = [makeSession({ id: 's1', type: 'strength', plannedDistanceKm: 0, estimatedMinutes: 20 })]
    expect(computeWeekTotals(sessions, zones)).toEqual({ totalKm: 0, totalMinutes: 20 })
    expect(sessionEstimatedMinutes(sessions[0], zones)).toBe(20)
  })
})
