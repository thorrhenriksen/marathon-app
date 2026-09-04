import { describe, it, expect } from 'vitest'
import { getDisplayStatus } from './sessionStatus'
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

  it.each(['handled', 'downgraded-to-mobility', 'skipped', 'moved'] as const)(
    'returns handled for status %s',
    (status) => {
      expect(getDisplayStatus(makeSession({ status, date: '2026-09-01' }), today)).toBe('handled')
    },
  )

  it('returns unlogged for a past, unresolved session', () => {
    expect(getDisplayStatus(makeSession({ status: 'planned', date: '2026-09-01' }), today)).toBe('unlogged')
  })

  it('returns planned for today or a future, unresolved session', () => {
    expect(getDisplayStatus(makeSession({ status: 'planned', date: '2026-09-04' }), today)).toBe('planned')
    expect(getDisplayStatus(makeSession({ status: 'planned', date: '2026-09-10' }), today)).toBe('planned')
  })

  it('prioritizes explicit completed/missed status over date', () => {
    expect(getDisplayStatus(makeSession({ status: 'completed', date: '2026-09-10' }), today)).toBe('completed')
    expect(getDisplayStatus(makeSession({ status: 'missed', date: '2026-09-10' }), today)).toBe('missed')
  })
})
