import { describe, it, expect } from 'vitest'
import { computeStreaks, computeAchievements } from './achievements'
import type { Session, TimeOff, WeekMeta } from '../types'

function makeWeek(week: number, startDate: string, overrides: Partial<WeekMeta> = {}): WeekMeta {
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
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `s-${Math.random()}`,
    week: 1,
    date: '2026-01-06',
    type: 'easy',
    plannedDistanceKm: 5,
    description: 'Easy run',
    status: 'planned',
    ...overrides,
  }
}

describe('computeStreaks', () => {
  const weeks = [
    makeWeek(1, '2026-01-05'), // Mon 5 Jan - Sun 11 Jan
    makeWeek(2, '2026-01-12'), // Mon 12 Jan - Sun 18 Jan
    makeWeek(3, '2026-01-19'), // Mon 19 Jan - Sun 25 Jan
    makeWeek(4, '2026-01-26'), // Mon 26 Jan - Sun 1 Feb
    makeWeek(5, '2026-02-02'), // Mon 2 Feb - Sun 8 Feb (not yet elapsed)
  ]
  const today = '2026-02-05'

  it('pauses a week fully covered by time off, without breaking the streak', () => {
    const sessions: Session[] = [
      makeSession({ week: 1, date: '2026-01-06', status: 'completed' }),
      // week 2 has no sessions logged at all — it's paused by time off below.
      makeSession({ week: 3, date: '2026-01-20', status: 'downgraded-to-mobility' }),
      makeSession({ week: 4, date: '2026-01-27', status: 'missed' }),
    ]
    const timeOff: TimeOff[] = [{ id: 't1', startDate: '2026-01-12', endDate: '2026-01-18', label: 'illness' }]

    const { current, longest } = computeStreaks(sessions, weeks, timeOff, today)
    // week1 counted, week2 paused (no-op), week3 counted (downgrade = handled) -> longest 2.
    expect(longest).toBe(2)
    // walking back from week4 (failed) stops immediately.
    expect(current).toBe(0)
  })

  it('treats an unlogged (pending) week as a pause point for current, not a break for longest', () => {
    const sessions: Session[] = [
      makeSession({ week: 1, date: '2026-01-06', status: 'completed' }),
      makeSession({ week: 2, date: '2026-01-13', status: 'planned' }), // past + unresolved -> unlogged/pending
      makeSession({ week: 3, date: '2026-01-20', status: 'completed' }),
    ]
    const shortWeeks = weeks.slice(0, 3) // only weeks 1-3 elapsed relative to `today`
    const { current, longest } = computeStreaks(sessions, shortWeeks, [], today)
    expect(longest).toBe(2) // week1 + week3, week2 pending is a no-op
    expect(current).toBe(1) // walking back from week3 (counted) then week2 (pending) halts
  })

  it('excludes weeks that have not yet elapsed', () => {
    const sessions: Session[] = [
      makeSession({ week: 1, date: '2026-01-06', status: 'completed' }),
      makeSession({ week: 2, date: '2026-01-13', status: 'completed' }),
      makeSession({ week: 3, date: '2026-01-20', status: 'completed' }),
      makeSession({ week: 4, date: '2026-01-27', status: 'completed' }),
      makeSession({ week: 5, date: '2026-02-03', status: 'completed' }), // week 5 hasn't elapsed yet
    ]
    const { current, longest } = computeStreaks(sessions, weeks, [], today)
    expect(current).toBe(4)
    expect(longest).toBe(4)
  })
})

describe('computeAchievements', () => {
  const weeks = [makeWeek(1, '2026-01-05'), makeWeek(2, '2026-01-12', { phase: 1 })]
  const sessions: Session[] = [makeSession({ week: 1, date: '2026-01-06', status: 'completed' })]
  const runs = [
    { id: 'r1', date: '2026-01-06', distanceKm: 10, durationSeconds: 3000, paceSecPerKm: 300, type: 'easy' as const, effort: 5 },
  ]
  const input = { sessions, runs, weeks, timeOffEntries: [] as TimeOff[], today: '2026-02-05' }

  it('is idempotent across repeated calls', () => {
    const first = computeAchievements(input)
    const second = computeAchievements(input)
    expect(second).toEqual(first)
  })
})
