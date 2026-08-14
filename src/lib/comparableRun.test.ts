import { describe, it, expect } from 'vitest'
import { findLastComparableRun } from './comparableRun'
import type { Run, Session } from '../types'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    week: 10,
    date: '2026-10-20',
    type: 'long',
    plannedDistanceKm: 20,
    description: 'Long run',
    status: 'planned',
    ...overrides,
  }
}

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    date: '2026-10-01',
    distanceKm: 20,
    durationSeconds: 7200,
    paceSecPerKm: 360,
    type: 'long',
    effort: 5,
    ...overrides,
  }
}

describe('findLastComparableRun', () => {
  it('matches a run of the same type within 30% distance tolerance', () => {
    const session = makeSession({ plannedDistanceKm: 20 })
    const run = makeRun({ distanceKm: 18 })
    expect(findLastComparableRun(session, [run])).toEqual(run)
  })

  it('includes a run exactly at the 30% boundary', () => {
    const session = makeSession({ plannedDistanceKm: 20 })
    const run = makeRun({ distanceKm: 14 }) // exactly -30%
    expect(findLastComparableRun(session, [run])).toEqual(run)
  })

  it('excludes a run beyond the 30% boundary', () => {
    const session = makeSession({ plannedDistanceKm: 20 })
    const run = makeRun({ distanceKm: 13.9 })
    expect(findLastComparableRun(session, [run])).toBeUndefined()
  })

  it('excludes the run already linked to the session', () => {
    const session = makeSession({ plannedDistanceKm: 20, linkedRunId: 'r1' })
    const run = makeRun({ id: 'r1', distanceKm: 20 })
    expect(findLastComparableRun(session, [run])).toBeUndefined()
  })

  it('excludes runs of a different type', () => {
    const session = makeSession({ type: 'long', plannedDistanceKm: 20 })
    const run = makeRun({ type: 'easy', distanceKm: 20 })
    expect(findLastComparableRun(session, [run])).toBeUndefined()
  })

  it('picks the most recent matching run by date', () => {
    const session = makeSession({ plannedDistanceKm: 20 })
    const older = makeRun({ id: 'r1', date: '2026-09-01', distanceKm: 19 })
    const newer = makeRun({ id: 'r2', date: '2026-10-01', distanceKm: 21 })
    expect(findLastComparableRun(session, [older, newer])).toEqual(newer)
  })

  it('breaks ties on equal dates by keeping the first-encountered candidate', () => {
    const session = makeSession({ plannedDistanceKm: 20 })
    const first = makeRun({ id: 'r1', date: '2026-10-01', distanceKm: 19 })
    const second = makeRun({ id: 'r2', date: '2026-10-01', distanceKm: 21 })
    expect(findLastComparableRun(session, [first, second])).toEqual(first)
  })

  it('returns undefined when there are no candidate runs', () => {
    const session = makeSession()
    expect(findLastComparableRun(session, [])).toBeUndefined()
  })
})
