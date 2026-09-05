import { describe, it, expect } from 'vitest'
import {
  computeStreaks,
  computeAchievements,
  computeDistanceFirsts,
  computeFirstRunDate,
  computeFirstCompletedWeek,
  computeRaceWeekReached,
  computeConsistencyStreak,
  computeRestDaysHonoredCount,
  computeSmartCallCount,
  computeTaperDisciplineWeeks,
} from './achievements'
import type { Run, Session, TimeOff, WeekMeta } from '../types'

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

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: `r-${Math.random()}`,
    date: '2026-01-06',
    distanceKm: 5,
    durationSeconds: 1500,
    paceSecPerKm: 300,
    type: 'easy',
    effort: 5,
    ...overrides,
  }
}

describe('computeDistanceFirsts', () => {
  it('includes the 25km threshold alongside 10/15/21.1/30', () => {
    const runs = [makeRun({ date: '2026-01-01', distanceKm: 26 })]
    const firsts = computeDistanceFirsts(runs)
    expect(firsts.map((f) => f.thresholdKm)).toEqual([10, 15, 21.1, 25, 30])
    const twentyFive = firsts.find((f) => f.thresholdKm === 25)
    expect(twentyFive?.date).toBe('2026-01-01')
  })
})

describe('computeFirstRunDate', () => {
  it('returns undefined with no runs, else the earliest date', () => {
    expect(computeFirstRunDate([])).toBeUndefined()
    const runs = [makeRun({ date: '2026-01-10' }), makeRun({ date: '2026-01-03' })]
    expect(computeFirstRunDate(runs)).toBe('2026-01-03')
  })
})

describe('computeFirstCompletedWeek', () => {
  const weeks = [makeWeek(1, '2026-01-05'), makeWeek(2, '2026-01-12')]
  const today = '2026-01-25'

  it('finds the earliest elapsed week with sessions that was fully handled', () => {
    const sessions: Session[] = [
      makeSession({ week: 1, date: '2026-01-06', status: 'missed' }),
      makeSession({ week: 2, date: '2026-01-13', status: 'completed' }),
    ]
    expect(computeFirstCompletedWeek(sessions, weeks, [], today)).toBe(2)
  })

  it('returns undefined when no elapsed week qualifies', () => {
    const sessions: Session[] = [makeSession({ week: 1, date: '2026-01-06', status: 'missed' })]
    expect(computeFirstCompletedWeek(sessions, weeks, [], today)).toBeUndefined()
  })
})

describe('computeRaceWeekReached', () => {
  it('is true only once today reaches the race week start date', () => {
    const weeks = [makeWeek(1, '2026-01-05'), makeWeek(35, '2026-08-31', { isRaceWeek: true })]
    expect(computeRaceWeekReached(weeks, '2026-08-30')).toBe(false)
    expect(computeRaceWeekReached(weeks, '2026-08-31')).toBe(true)
    expect(computeRaceWeekReached(weeks, '2026-09-04')).toBe(true)
  })
})

describe('computeConsistencyStreak', () => {
  const weeks = [
    makeWeek(1, '2026-01-05'),
    makeWeek(2, '2026-01-12'),
    makeWeek(3, '2026-01-19'),
    makeWeek(4, '2026-01-26'),
  ]
  const today = '2026-02-05'

  it('counts consecutive elapsed weeks at >=90% adherence, reset on a dip', () => {
    const sessions: Session[] = [
      makeSession({ week: 1, date: '2026-01-06', status: 'completed' }),
      makeSession({ week: 2, date: '2026-01-13', status: 'completed' }),
      makeSession({ week: 3, date: '2026-01-20', status: 'missed' }),
      makeSession({ week: 4, date: '2026-01-27', status: 'completed' }),
    ]
    expect(computeConsistencyStreak(sessions, weeks, today)).toBe(2)
  })
})

describe('computeRestDaysHonoredCount', () => {
  const weeks = [makeWeek(1, '2026-01-05'), makeWeek(2, '2026-01-12')]
  const today = '2026-01-25'

  it('counts weeks where every rest session stayed planned', () => {
    const sessions: Session[] = [
      makeSession({ week: 1, date: '2026-01-10', type: 'rest', status: 'planned' }),
      makeSession({ week: 2, date: '2026-01-17', type: 'rest', status: 'handled' }),
    ]
    expect(computeRestDaysHonoredCount(sessions, weeks, today)).toBe(1)
  })
})

describe('computeSmartCallCount', () => {
  it('counts downgraded-to-mobility and non-rest handled sessions', () => {
    const sessions: Session[] = [
      makeSession({ status: 'downgraded-to-mobility' }),
      makeSession({ status: 'handled', type: 'easy' }),
      makeSession({ status: 'handled', type: 'rest' }), // rest 'handled' is not a smart-call use
      makeSession({ status: 'completed' }),
    ]
    expect(computeSmartCallCount(sessions)).toBe(2)
  })
})

describe('computeTaperDisciplineWeeks', () => {
  it('flags taper weeks completed at or under target volume', () => {
    const weeks = [makeWeek(33, '2026-08-10', { isTaper: true, targetVolumeKm: 30 })]
    const today = '2026-08-20'
    const underRuns = [makeRun({ date: '2026-08-11', distanceKm: 25 })]
    expect(computeTaperDisciplineWeeks(underRuns, weeks, today)).toEqual([33])

    const overRuns = [makeRun({ date: '2026-08-11', distanceKm: 40 })]
    expect(computeTaperDisciplineWeeks(overRuns, weeks, today)).toEqual([])
  })
})
