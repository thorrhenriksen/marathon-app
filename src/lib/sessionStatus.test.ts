import { describe, it, expect } from 'vitest'
import { getDisplayStatus, canMarkMissed } from './sessionStatus'
import type { Session } from '../types'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    week: 1,
    date: '2026-09-01',
    type: 'easy',
    plannedDistanceKm: 5,
    description: 'Easy run',
    status: 'planned',
    ...overrides,
  }
}

describe('getDisplayStatus', () => {
  const today = '2026-09-04'

  it('returns completed when status is completed', () => {
    expect(getDisplayStatus(makeSession({ status: 'completed', date: '2026-09-01' }), today)).toBe('completed')
  })

  it('returns missed when status is missed', () => {
    expect(getDisplayStatus(makeSession({ status: 'missed', date: '2026-09-01' }), today)).toBe('missed')
  })

  it.each(['handled', 'downgraded-to-mobility', 'skipped'] as const)(
    'returns handled for status %s',
    (status) => {
      expect(getDisplayStatus(makeSession({ status, date: '2026-09-01' }), today)).toBe('handled')
    },
  )

  it('returns unlogged for a past, unresolved session', () => {
    expect(getDisplayStatus(makeSession({ status: 'planned', date: '2026-09-01' }), today)).toBe('unlogged')
  })

  it('returns unlogged for a moved session whose new date has passed without being completed', () => {
    expect(getDisplayStatus(makeSession({ status: 'moved', date: '2026-09-01' }), today)).toBe('unlogged')
  })

  it('returns planned for a moved session whose new date is still upcoming', () => {
    expect(getDisplayStatus(makeSession({ status: 'moved', date: '2026-09-10' }), today)).toBe('planned')
  })

  it('returns planned for today or a future, unresolved session', () => {
    expect(getDisplayStatus(makeSession({ status: 'planned', date: '2026-09-04' }), today)).toBe('planned')
    expect(getDisplayStatus(makeSession({ status: 'planned', date: '2026-09-10' }), today)).toBe('planned')
  })

  it('prioritizes explicit completed/missed status over date', () => {
    expect(getDisplayStatus(makeSession({ status: 'completed', date: '2026-09-10' }), today)).toBe('completed')
    expect(getDisplayStatus(makeSession({ status: 'missed', date: '2026-09-10' }), today)).toBe('missed')
  })

  it('never flags a rest day as unlogged, even if past and unresolved', () => {
    expect(getDisplayStatus(makeSession({ type: 'rest', status: 'planned', date: '2026-09-01' }), today)).toBe(
      'planned',
    )
  })
})

describe('canMarkMissed', () => {
  const today = '2026-09-04'

  it('is true for a past, unresolved session', () => {
    expect(canMarkMissed(makeSession({ status: 'planned', date: '2026-09-01' }), today)).toBe(true)
  })

  it('is true for today\'s unresolved session', () => {
    expect(canMarkMissed(makeSession({ status: 'planned', date: today }), today)).toBe(true)
  })

  it('is false for a future session', () => {
    expect(canMarkMissed(makeSession({ status: 'planned', date: '2026-09-10' }), today)).toBe(false)
  })

  it('is false once already resolved (completed, missed, or handled)', () => {
    expect(canMarkMissed(makeSession({ status: 'completed', date: '2026-09-01' }), today)).toBe(false)
    expect(canMarkMissed(makeSession({ status: 'missed', date: '2026-09-01' }), today)).toBe(false)
    expect(canMarkMissed(makeSession({ status: 'handled', date: '2026-09-01' }), today)).toBe(false)
  })

  it('is false for rest days', () => {
    expect(canMarkMissed(makeSession({ type: 'rest', status: 'planned', date: '2026-09-01' }), today)).toBe(false)
  })

  it('is true for a moved session whose new date is today or in the past', () => {
    expect(canMarkMissed(makeSession({ status: 'moved', date: '2026-09-01' }), today)).toBe(true)
    expect(canMarkMissed(makeSession({ status: 'moved', date: today }), today)).toBe(true)
  })

  it('is false for a moved session whose new date is still upcoming', () => {
    expect(canMarkMissed(makeSession({ status: 'moved', date: '2026-09-10' }), today)).toBe(false)
  })
})
