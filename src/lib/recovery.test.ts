import { describe, it, expect } from 'vitest'
import { computeActivityLoad, computeRecoveryState, computeRefuelPrompt, type ActivitySource } from './recovery'
import type { Session } from '../types'

function makeActivity(overrides: Partial<ActivitySource> = {}): ActivitySource {
  return {
    type: 'easy',
    date: '2026-09-03',
    durationMinutes: 30,
    assumedTime: true,
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    week: 2,
    date: '2026-09-04',
    type: 'easy',
    plannedDistanceKm: 5,
    description: 'Easy run',
    status: 'planned',
    ...overrides,
  }
}

describe('computeActivityLoad', () => {
  it('rates a short easy run as light with no wait', () => {
    const { level, qualityWaitHours } = computeActivityLoad(makeActivity({ type: 'easy', durationMinutes: 30 }))
    expect(level).toBe('light')
    expect(qualityWaitHours).toBe(0)
  })

  it('rates a 45+ minute easy run as moderate with a 24h wait', () => {
    const { level, qualityWaitHours } = computeActivityLoad(makeActivity({ type: 'easy', durationMinutes: 50 }))
    expect(level).toBe('moderate')
    expect(qualityWaitHours).toBe(24)
  })

  it('rates tempo, long, and strength as hard with a 48h wait', () => {
    for (const type of ['tempo', 'long', 'strength'] as const) {
      const { level, qualityWaitHours } = computeActivityLoad(makeActivity({ type, durationMinutes: 60 }))
      expect(level).toBe('hard')
      expect(qualityWaitHours).toBe(48)
    }
  })

  it('bumps a light run up a band when effort is very high', () => {
    const { level, reasoning } = computeActivityLoad(
      makeActivity({ type: 'easy', durationMinutes: 20, effort: 9 }),
    )
    expect(level).toBe('moderate')
    expect(reasoning).toContain('effort was 9/10')
  })

  it('bumps a run up a band when distance is 20%+ over planned', () => {
    const { level, reasoning } = computeActivityLoad(
      makeActivity({ type: 'easy', durationMinutes: 20, distanceKm: 8, plannedDistanceKm: 5 }),
    )
    expect(level).toBe('moderate')
    expect(reasoning).toContain('20%+ over planned')
  })
})

describe('computeRecoveryState', () => {
  const today = '2026-09-04'

  it('reports recovered with no recent activity', () => {
    const { band } = computeRecoveryState([], today)
    expect(band).toBe('recovered')
  })

  it('reports recently-worked for a hard effort logged today', () => {
    const { band, nextQualityDate } = computeRecoveryState(
      [makeActivity({ type: 'long', date: today, durationMinutes: 120 })],
      today,
    )
    expect(band).toBe('recently-worked')
    expect(nextQualityDate).toBe('2026-09-06')
  })

  it('reports recovering the day after a hard effort', () => {
    const { band } = computeRecoveryState(
      [makeActivity({ type: 'long', date: '2026-09-03', durationMinutes: 120 })],
      today,
    )
    expect(band).toBe('recovering')
  })

  it('reports recovered (not stale hard-effort wording) once the wait window has passed', () => {
    const { band, reasoning } = computeRecoveryState(
      [makeActivity({ type: 'strength', date: '2026-09-02', durationMinutes: 30 })],
      today,
    )
    expect(band).toBe('recovered')
    expect(reasoning).toContain('Recovered')
  })

  it('softens guidance instead of contradicting a scheduled non-rest session when yesterday was on plan', () => {
    const yesterday = makeActivity({
      type: 'long',
      date: '2026-09-03',
      durationMinutes: 120,
      distanceKm: 20,
      plannedDistanceKm: 20,
    })
    const scheduled = makeSession({ date: today, type: 'easy' })
    const { band, reasoning } = computeRecoveryState([yesterday], today, scheduled)
    expect(band).toBe('recovering')
    expect(reasoning).toContain('keep it genuinely easy')
  })

  it('does not soften guidance when yesterday was logged harder than planned', () => {
    const yesterday = makeActivity({
      type: 'long',
      date: '2026-09-03',
      durationMinutes: 150,
      distanceKm: 26,
      plannedDistanceKm: 20,
    })
    const scheduled = makeSession({ date: today, type: 'easy' })
    const { reasoning } = computeRecoveryState([yesterday], today, scheduled)
    expect(reasoning).not.toContain('keep it genuinely easy')
  })
})

describe('computeRefuelPrompt', () => {
  it('is active for a 45+ min run logged within the last 2 hours', () => {
    const now = new Date('2026-09-04T12:00:00Z')
    const activity = makeActivity({
      type: 'easy',
      durationMinutes: 50,
      timestamp: '2026-09-04T11:00:00Z',
      assumedTime: false,
    })
    const { active, minutesRemaining } = computeRefuelPrompt([activity], now)
    expect(active).toBe(true)
    expect(minutesRemaining).toBe(60)
  })

  it('is inactive once the 2-hour window has passed', () => {
    const now = new Date('2026-09-04T14:00:00Z')
    const activity = makeActivity({
      type: 'easy',
      durationMinutes: 50,
      timestamp: '2026-09-04T11:00:00Z',
      assumedTime: false,
    })
    const { active } = computeRefuelPrompt([activity], now)
    expect(active).toBe(false)
  })

  it('never triggers for an activity with only an assumed timestamp', () => {
    const now = new Date('2026-09-04T09:30:00Z')
    const activity = makeActivity({
      type: 'long',
      durationMinutes: 120,
      timestamp: '2026-09-04T09:00:00Z',
      assumedTime: true,
    })
    const { active } = computeRefuelPrompt([activity], now)
    expect(active).toBe(false)
  })

  it('is inactive for a short easy run', () => {
    const now = new Date('2026-09-04T09:30:00Z')
    const activity = makeActivity({
      type: 'easy',
      durationMinutes: 20,
      timestamp: '2026-09-04T09:00:00Z',
      assumedTime: false,
    })
    const { active } = computeRefuelPrompt([activity], now)
    expect(active).toBe(false)
  })
})
