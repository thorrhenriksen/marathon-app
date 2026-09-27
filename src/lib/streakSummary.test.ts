import { describe, it, expect } from 'vitest'
import { explainStreak, computeStreakSummary, formatStreakChip } from './streakSummary'
import type { Session, WeekMeta } from '../types'

function makeWeek(week: number, startDate: string): WeekMeta {
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

function makeSession(id: string, week: number, date: string, status: Session['status']): Session {
  return { id, week, date, type: 'easy', plannedDistanceKm: 5, description: 'Easy run', status }
}

describe('explainStreak', () => {
  it('names the weeks that broke the run and when the streak began', () => {
    const statuses = [
      { week: 1, status: 'failed' as const },
      { week: 2, status: 'failed' as const },
      { week: 3, status: 'counted' as const },
      { week: 4, status: 'counted' as const },
    ]
    expect(explainStreak(statuses, 2)).toBe('Weeks 1 and 2 each had a missed session; your streak began week 3.')
  })

  it('skips paused weeks when locating the streak start', () => {
    const statuses = [
      { week: 1, status: 'failed' as const },
      { week: 2, status: 'paused' as const },
      { week: 3, status: 'counted' as const },
    ]
    expect(explainStreak(statuses, 1)).toBe('Week 1 had a missed session; your streak began week 3.')
  })

  it('explains an unbroken streak', () => {
    const statuses = [
      { week: 1, status: 'counted' as const },
      { week: 2, status: 'counted' as const },
    ]
    expect(explainStreak(statuses, 2)).toBe('Every finished week so far has counted — your streak began week 1.')
  })

  it('explains a zero streak caused by an unlogged session', () => {
    expect(explainStreak([{ week: 1, status: 'pending' }], 0)).toMatch(/Week 1 has an unlogged session/)
  })

  it('explains a zero streak caused by a miss', () => {
    expect(explainStreak([{ week: 1, status: 'counted' }, { week: 2, status: 'failed' }], 0)).toBe(
      'Week 2 had a missed session, so the streak restarts from the next full week.',
    )
  })

  it('handles no finished weeks', () => {
    expect(explainStreak([], 0)).toMatch(/No full plan weeks have finished yet/)
  })
})

describe('computeStreakSummary / formatStreakChip', () => {
  const weeks = [makeWeek(1, '2026-08-24'), makeWeek(2, '2026-08-31'), makeWeek(3, '2026-09-07')]
  const today = '2026-09-10'

  it('leads with the streak when it is 2+', () => {
    const sessions = [
      makeSession('a', 1, '2026-08-25', 'completed'),
      makeSession('b', 2, '2026-09-01', 'completed'),
      makeSession('c', 3, '2026-09-08', 'completed'),
      makeSession('d', 3, '2026-09-09', 'planned'),
    ]
    const summary = computeStreakSummary(sessions, weeks, [], today)
    expect(summary.current).toBe(2)
    expect(summary.leadWithAdherence).toBe(false)
    expect(formatStreakChip(summary)).toBe('🔥2 · 3/4 sessions · 75%')
  })

  it('leads with adherence when the streak is 0 or 1', () => {
    const sessions = [
      makeSession('a', 1, '2026-08-25', 'completed'),
      makeSession('b', 1, '2026-08-26', 'completed'),
      makeSession('c', 1, '2026-08-27', 'completed'),
      makeSession('d', 2, '2026-09-01', 'missed'),
    ]
    const summary = computeStreakSummary(sessions, weeks, [], today)
    expect(summary.current).toBe(0)
    expect(summary.leadWithAdherence).toBe(true)
    expect(formatStreakChip(summary)).toBe('75% · 3/4 sessions · 🔥0')
  })
})
