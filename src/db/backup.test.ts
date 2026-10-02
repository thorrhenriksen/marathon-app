import { describe, it, expect, vi } from 'vitest'

// The pure payload helpers don't touch IndexedDB.
vi.mock('./db', () => ({ db: {} }))

import { buildBackupPayload, mergeStravaOnRestore, parseBackup } from './backup'
import { pendingActivities, EMPTY_STRAVA_STATE } from '../lib/strava'
import type { Run, StravaActivity, StravaState } from '../types'

const act = (id: number): StravaActivity => ({
  id,
  name: 'Run',
  startDateLocal: `2026-09-2${id}T07:00:00Z`,
  distanceMeters: 8000,
  movingTimeSeconds: 2600,
})

const importedRun: Run = {
  id: 'r1',
  date: '2026-09-21',
  distanceKm: 8,
  durationSeconds: 2600,
  paceSecPerKm: 325,
  type: 'easy',
  effort: 4,
  stravaActivityId: 1,
}

const stravaState: StravaState = {
  id: 'strava',
  connection: { accessToken: 'a', refreshToken: 'r', expiresAt: 2_000_000_000, athleteName: 'Test Runner' },
  importedActivityIds: [1],
  ignoredActivityIds: [2],
  recentActivities: [act(1), act(2), act(3)],
  pendingOAuthState: 'in-flight',
}

function roundTrip(strava: StravaState[] | undefined) {
  const payload = buildBackupPayload(
    { sessions: [], runs: [importedRun], goals: [], timeOff: [], settings: [], weeks: [], strava },
    '2026-10-02T00:00:00Z',
  )
  return parseBackup(JSON.stringify(payload))
}

describe('backup round-trip of Strava state', () => {
  it('preserves the connection and imported/ignored ids, and drops OAuth state', () => {
    const restored = roundTrip([stravaState])
    expect(restored.strava?.[0].importedActivityIds).toEqual([1])
    expect(restored.strava?.[0].ignoredActivityIds).toEqual([2])
    expect(restored.strava?.[0].connection?.athleteName).toBe('Test Runner')
    expect(restored.strava?.[0].pendingOAuthState).toBeUndefined()
    expect(restored.runs[0].stravaActivityId).toBe(1)
  })

  it('restoring onto a fresh device never resurfaces handled activities', () => {
    const restored = roundTrip([stravaState])
    const merged = mergeStravaOnRestore(undefined, restored.strava?.[0])
    expect(pendingActivities(merged, restored.runs).map((a) => a.id)).toEqual([3])
  })

  it('unions ids with the device’s current state and keeps the live connection', () => {
    const restored = roundTrip([stravaState])
    const current: StravaState = {
      ...EMPTY_STRAVA_STATE,
      connection: { accessToken: 'live', refreshToken: 'live-r', expiresAt: 2_100_000_000, athleteName: 'Test Runner' },
      importedActivityIds: [3],
      recentActivities: [act(1), act(2), act(3), act(4)],
    }
    const merged = mergeStravaOnRestore(current, restored.strava?.[0])
    expect(merged.connection?.accessToken).toBe('live')
    expect(merged.importedActivityIds.sort()).toEqual([1, 3])
    expect(merged.ignoredActivityIds).toEqual([2])
    expect(pendingActivities(merged, restored.runs).map((a) => a.id)).toEqual([4])
  })

  it('accepts pre-Strava backups, relying on run ids alone', () => {
    const restored = roundTrip(undefined)
    const merged = mergeStravaOnRestore(undefined, restored.strava?.[0])
    expect(merged.importedActivityIds).toEqual([])
    const withCache: StravaState = { ...merged, connection: stravaState.connection, recentActivities: [act(1), act(3)] }
    expect(pendingActivities(withCache, restored.runs).map((a) => a.id)).toEqual([3])
  })
})
