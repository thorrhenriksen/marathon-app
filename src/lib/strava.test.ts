import { describe, it, expect, vi } from 'vitest'
import {
  StravaAuthError,
  activityPaceSecPerKm,
  activityToPrefill,
  fetchRecentRuns,
  findPossibleDuplicate,
  metersToKm,
  parseCallback,
  pendingActivities,
  shouldFetch,
  suggestSessionForDate,
  toStravaActivity,
  tokenNeedsRefresh,
  EMPTY_STRAVA_STATE,
  STRAVA_FETCH_THROTTLE_MS,
  type StravaDeps,
} from './strava'
import type { Run, Session, StravaActivity, StravaConnection, StravaState } from '../types'

function activity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 1001,
    name: 'Morning Run',
    startDateLocal: '2026-10-01T07:12:34Z',
    distanceMeters: 10_016.4,
    movingTimeSeconds: 3134,
    ...overrides,
  }
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    date: '2026-10-01',
    distanceKm: 10,
    durationSeconds: 3100,
    paceSecPerKm: 310,
    type: 'easy',
    effort: 5,
    ...overrides,
  }
}

function state(overrides: Partial<StravaState> = {}): StravaState {
  return { ...EMPTY_STRAVA_STATE, recentActivities: [activity()], ...overrides }
}

const NOW = Date.parse('2026-10-02T12:00:00Z')

function connection(overrides: Partial<StravaConnection> = {}): StravaConnection {
  return {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    expiresAt: NOW / 1000 + 3600,
    athleteName: 'Test Runner',
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('activity mapping', () => {
  it('converts meters to km at 2 dp', () => {
    expect(metersToKm(10_016.4)).toBe(10.02)
    expect(metersToKm(5000)).toBe(5)
    expect(metersToKm(21_097.5)).toBe(21.1)
    expect(metersToKm(1234)).toBe(1.23)
  })

  it('prefills date, local time, km and moving time as duration', () => {
    expect(activityToPrefill(activity())).toEqual({
      date: '2026-10-01',
      time: '07:12',
      distanceKm: 10.02,
      durationSeconds: 3134,
      stravaActivityId: 1001,
    })
  })

  it('reads start_date_local as wall-clock time regardless of the trailing Z', () => {
    expect(activityToPrefill(activity({ startDateLocal: '2026-10-01T23:45:00Z' })).date).toBe('2026-10-01')
  })

  it('computes pace from the rounded km and moving time', () => {
    expect(activityPaceSecPerKm(activity({ distanceMeters: 10_000, movingTimeSeconds: 3000 }))).toBe(300)
  })

  it('keeps only runs with usable distance and moving time', () => {
    const base = { id: 1, name: 'x', start_date_local: '2026-10-01T07:00:00Z', distance: 5000, moving_time: 1500 }
    expect(toStravaActivity({ ...base, type: 'Run' })).toEqual({
      id: 1,
      name: 'x',
      startDateLocal: '2026-10-01T07:00:00Z',
      distanceMeters: 5000,
      movingTimeSeconds: 1500,
    })
    expect(toStravaActivity({ ...base, type: 'Ride' })).toBeNull()
    expect(toStravaActivity({ ...base, type: 'Run', distance: 0 })).toBeNull()
    expect(toStravaActivity({ ...base, type: 'Run', moving_time: 0 })).toBeNull()
  })
})

describe('pendingActivities (dedupe by activity id)', () => {
  it('returns unhandled activities oldest first', () => {
    const s = state({
      recentActivities: [
        activity({ id: 3, startDateLocal: '2026-10-01T07:00:00Z' }),
        activity({ id: 1, startDateLocal: '2026-09-28T07:00:00Z' }),
        activity({ id: 2, startDateLocal: '2026-09-30T07:00:00Z' }),
      ],
    })
    expect(pendingActivities(s, []).map((a) => a.id)).toEqual([1, 2, 3])
  })

  it('drops imported, ignored, and run-linked activities, and duplicate ids', () => {
    const s = state({
      importedActivityIds: [1],
      ignoredActivityIds: [2],
      recentActivities: [1, 2, 3, 4, 4].map((id) => activity({ id })),
    })
    expect(pendingActivities(s, [run({ stravaActivityId: 3 })]).map((a) => a.id)).toEqual([4])
  })

  it('is empty without state', () => {
    expect(pendingActivities(undefined, [])).toEqual([])
  })
})

describe('findPossibleDuplicate', () => {
  it('matches a same-day manual run within 10% distance', () => {
    expect(findPossibleDuplicate(activity(), [run({ distanceKm: 9.1 })])?.id).toBe('r1')
    expect(findPossibleDuplicate(activity(), [run({ distanceKm: 11 })])?.id).toBe('r1')
  })

  it('rejects runs outside 10%, on another day, or already linked to Strava', () => {
    expect(findPossibleDuplicate(activity(), [run({ distanceKm: 8.9 })])).toBeUndefined()
    expect(findPossibleDuplicate(activity(), [run({ date: '2026-09-30' })])).toBeUndefined()
    expect(findPossibleDuplicate(activity(), [run({ stravaActivityId: 999 })])).toBeUndefined()
  })

  it('picks the closest of several candidates', () => {
    const runs = [run({ id: 'far', distanceKm: 9.2 }), run({ id: 'close', distanceKm: 10.1 })]
    expect(findPossibleDuplicate(activity(), runs)?.id).toBe('close')
  })
})

describe('suggestSessionForDate', () => {
  const session = (overrides: Partial<Session>): Session => ({
    id: 's',
    week: 6,
    date: '2026-10-01',
    type: 'easy',
    plannedDistanceKm: 8,
    description: '',
    status: 'planned',
    ...overrides,
  })

  it('suggests the day’s unlinked, unfinished run session only', () => {
    const sessions = [
      session({ id: 'strength', type: 'strength' }),
      session({ id: 'done', status: 'completed' }),
      session({ id: 'easy' }),
    ]
    expect(suggestSessionForDate(sessions, '2026-10-01')?.id).toBe('easy')
    expect(suggestSessionForDate(sessions, '2026-10-02')).toBeUndefined()
    expect(suggestSessionForDate([session({ linkedRunId: 'r' })], '2026-10-01')).toBeUndefined()
  })
})

describe('throttle', () => {
  it('fetches at most once per 30 minutes while connected', () => {
    expect(shouldFetch(state({ connection: connection() }), NOW)).toBe(true)
    const recent = new Date(NOW - STRAVA_FETCH_THROTTLE_MS + 1000).toISOString()
    expect(shouldFetch(state({ connection: connection(), lastFetchAttemptAt: recent }), NOW)).toBe(false)
    const old = new Date(NOW - STRAVA_FETCH_THROTTLE_MS).toISOString()
    expect(shouldFetch(state({ connection: connection(), lastFetchAttemptAt: old }), NOW)).toBe(true)
  })

  it('never fetches when disconnected or awaiting reconnect', () => {
    expect(shouldFetch(state(), NOW)).toBe(false)
    expect(shouldFetch(state({ connection: connection({ needsReconnect: true }) }), NOW)).toBe(false)
  })
})

describe('parseCallback', () => {
  it('recognises the redirect marker and reads OAuth params', () => {
    expect(parseCallback('?strava=callback&state=abc&code=123&scope=read,activity:read')).toEqual({
      code: '123',
      state: 'abc',
      scope: 'read,activity:read',
      error: undefined,
    })
    expect(parseCallback('?strava=callback&error=access_denied')?.error).toBe('access_denied')
    expect(parseCallback('?code=123')).toBeNull()
  })
})

describe('token refresh path', () => {
  const activitiesBody = [
    { id: 7, type: 'Run', name: 'Run', start_date_local: '2026-10-01T07:00:00Z', distance: 5000, moving_time: 1500 },
    { id: 8, type: 'Ride', name: 'Ride', start_date_local: '2026-10-01T09:00:00Z', distance: 20000, moving_time: 3600 },
  ]
  const refreshed = { access_token: 'new-access', refresh_token: 'new-refresh', expires_at: NOW / 1000 + 21600 }

  function deps(responses: Response[]) {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => {
      const next = responses.shift()
      if (!next) throw new Error('unexpected fetch')
      return next
    })
    const saveConnection = vi.fn(async (_c: StravaConnection) => {})
    const d: StravaDeps = { fetch: fetchMock as unknown as typeof fetch, now: () => NOW, saveConnection }
    return { d, fetchMock, saveConnection }
  }

  function authHeader(call: Parameters<typeof fetch>): string | undefined {
    return (call[1]?.headers as Record<string, string> | undefined)?.Authorization
  }

  it('uses a valid token directly and keeps only runs', async () => {
    const { d, fetchMock, saveConnection } = deps([jsonResponse(200, activitiesBody)])
    const result = await fetchRecentRuns(connection(), d)
    expect(result.map((a) => a.id)).toEqual([7])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v3/athlete/activities?after=')
    expect(authHeader(fetchMock.mock.calls[0])).toBe('Bearer old-access')
    expect(saveConnection).not.toHaveBeenCalled()
  })

  it('refreshes an expired token before fetching and persists it', async () => {
    expect(tokenNeedsRefresh(connection({ expiresAt: NOW / 1000 - 10 }), NOW)).toBe(true)
    const { d, fetchMock, saveConnection } = deps([jsonResponse(200, refreshed), jsonResponse(200, activitiesBody)])
    await fetchRecentRuns(connection({ expiresAt: NOW / 1000 - 10 }), d)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/strava/refresh')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ refresh_token: 'old-refresh' })
    expect(authHeader(fetchMock.mock.calls[1])).toBe('Bearer new-access')
    expect(saveConnection).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'new-access', refreshToken: 'new-refresh', athleteName: 'Test Runner' }),
    )
  })

  it('refreshes once and retries on a 401', async () => {
    const { d, fetchMock } = deps([
      jsonResponse(401, { message: 'Authorization Error' }),
      jsonResponse(200, refreshed),
      jsonResponse(200, activitiesBody),
    ])
    const result = await fetchRecentRuns(connection(), d)
    expect(result).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(authHeader(fetchMock.mock.calls[2])).toBe('Bearer new-access')
  })

  it('raises StravaAuthError when the refresh token is rejected', async () => {
    const { d } = deps([jsonResponse(401, { error: 'refresh_failed' })])
    await expect(fetchRecentRuns(connection({ expiresAt: 0 }), d)).rejects.toBeInstanceOf(StravaAuthError)
  })
})
