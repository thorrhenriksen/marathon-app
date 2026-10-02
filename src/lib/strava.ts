// Strava integration: pure mapping/dedupe logic plus a small client that
// talks to Strava directly from the device. The only server involvement is
// the two stateless OAuth pass-throughs in api/strava/ (token + refresh),
// which hold the client secret. Activity data never leaves the device.

import { computePaceSecPerKm } from './paceZones'
import type { Run, Session, StravaActivity, StravaConnection, StravaState } from '../types'

export const STRAVA_FETCH_THROTTLE_MS = 30 * 60 * 1000
export const STRAVA_LOOKBACK_DAYS = 14
/** Refresh slightly before expiry so a request never races the deadline. */
const EXPIRY_SKEW_MS = 60 * 1000
/** A manual run within this fraction of the activity's distance on the same day is a likely duplicate. */
const DUPLICATE_DISTANCE_TOLERANCE = 0.1

export const STRAVA_CALLBACK_PARAM = 'strava'
export const STRAVA_CALLBACK_VALUE = 'callback'
export const STRAVA_SCOPE = 'activity:read'

export const EMPTY_STRAVA_STATE: StravaState = {
  id: 'strava',
  importedActivityIds: [],
  ignoredActivityIds: [],
  recentActivities: [],
}

// --- Mapping -----------------------------------------------------------

/** Meters → km, rounded to 2 dp. */
export function metersToKm(meters: number): number {
  return Math.round(meters / 10) / 100
}

/** Strava's start_date_local is local wall-clock time with a misleading "Z";
 *  read it as a string rather than through Date to avoid a timezone shift. */
export function activityDate(activity: StravaActivity): string {
  return activity.startDateLocal.slice(0, 10)
}

export function activityTime(activity: StravaActivity): string {
  return activity.startDateLocal.slice(11, 16)
}

export function activityDistanceKm(activity: StravaActivity): number {
  return metersToKm(activity.distanceMeters)
}

export function activityPaceSecPerKm(activity: StravaActivity): number {
  return computePaceSecPerKm(activityDistanceKm(activity), activity.movingTimeSeconds)
}

export interface RunPrefill {
  date: string
  time: string
  distanceKm: number
  /** Moving time, not elapsed time — stops at lights don't count. */
  durationSeconds: number
  stravaActivityId: number
}

export function activityToPrefill(activity: StravaActivity): RunPrefill {
  return {
    date: activityDate(activity),
    time: activityTime(activity),
    distanceKm: activityDistanceKm(activity),
    durationSeconds: activity.movingTimeSeconds,
    stravaActivityId: activity.id,
  }
}

interface RawStravaActivity {
  id?: unknown
  name?: unknown
  type?: unknown
  start_date_local?: unknown
  distance?: unknown
  moving_time?: unknown
}

/** Reduces a raw /athlete/activities entry to a cached StravaActivity, or
 *  null when it isn't a run or is missing what the import needs. */
export function toStravaActivity(raw: RawStravaActivity): StravaActivity | null {
  if (raw.type !== 'Run') return null
  if (typeof raw.id !== 'number' || typeof raw.start_date_local !== 'string') return null
  if (typeof raw.distance !== 'number' || raw.distance <= 0) return null
  if (typeof raw.moving_time !== 'number' || raw.moving_time <= 0) return null
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : 'Run',
    startDateLocal: raw.start_date_local,
    distanceMeters: raw.distance,
    movingTimeSeconds: raw.moving_time,
  }
}

// --- Import queue --------------------------------------------------------

/** Activities still waiting for a decision, oldest first. An activity is
 *  done once it's in the imported or ignored list, or any run carries its
 *  id (so a restored backup's runs alone are enough to suppress it). */
export function pendingActivities(state: StravaState | undefined, runs: Run[]): StravaActivity[] {
  if (!state) return []
  const done = new Set<number>([...state.importedActivityIds, ...state.ignoredActivityIds])
  for (const run of runs) if (run.stravaActivityId !== undefined) done.add(run.stravaActivityId)
  const seen = new Set<number>()
  return state.recentActivities
    .filter((a) => {
      if (done.has(a.id) || seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })
    .sort((a, b) => (a.startDateLocal < b.startDateLocal ? -1 : a.startDateLocal > b.startDateLocal ? 1 : 0))
}

/** A manually logged run on the same date within 10% of the activity's
 *  distance (closest match wins). Runs already tied to a Strava activity are
 *  never candidates. */
export function findPossibleDuplicate(activity: StravaActivity, runs: Run[]): Run | undefined {
  const date = activityDate(activity)
  const km = activityDistanceKm(activity)
  let best: Run | undefined
  let bestDelta = Infinity
  for (const run of runs) {
    if (run.date !== date || run.stravaActivityId !== undefined) continue
    const delta = Math.abs(run.distanceKm - km)
    if (delta <= km * DUPLICATE_DISTANCE_TOLERANCE && delta < bestDelta) {
      best = run
      bestDelta = delta
    }
  }
  return best
}

/** The scheduled run on this date that a logged run would complete — same
 *  rule as SessionCard's "Log" button, plus not already linked. */
export function suggestSessionForDate(sessions: Session[], date: string): Session | undefined {
  return sessions.find(
    (s) =>
      s.date === date &&
      s.type !== 'rest' &&
      s.type !== 'strength' &&
      s.status !== 'completed' &&
      s.status !== 'skipped' &&
      !s.linkedRunId,
  )
}

// --- Throttle / tokens ---------------------------------------------------

export function shouldFetch(state: StravaState | undefined, nowMs: number): boolean {
  if (!state?.connection || state.connection.needsReconnect) return false
  if (!state.lastFetchAttemptAt) return true
  return nowMs - Date.parse(state.lastFetchAttemptAt) >= STRAVA_FETCH_THROTTLE_MS
}

export function tokenNeedsRefresh(connection: StravaConnection, nowMs: number): boolean {
  return connection.expiresAt * 1000 <= nowMs + EXPIRY_SKEW_MS
}

// --- OAuth URLs ------------------------------------------------------------

export function stravaRedirectUri(origin: string): string {
  return `${origin}/?${STRAVA_CALLBACK_PARAM}=${STRAVA_CALLBACK_VALUE}`
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPE,
    state,
  })
  return `https://www.strava.com/oauth/authorize?${params}`
}

export interface OAuthCallback {
  code?: string
  state?: string
  scope?: string
  error?: string
}

/** Parses the redirect landing's query string; null when this isn't a Strava callback. */
export function parseCallback(search: string): OAuthCallback | null {
  const params = new URLSearchParams(search)
  if (params.get(STRAVA_CALLBACK_PARAM) !== STRAVA_CALLBACK_VALUE) return null
  return {
    code: params.get('code') ?? undefined,
    state: params.get('state') ?? undefined,
    scope: params.get('scope') ?? undefined,
    error: params.get('error') ?? undefined,
  }
}

// --- Network client --------------------------------------------------------

/** Strava rejected the refresh token: the grant is gone and the user must reconnect. */
export class StravaAuthError extends Error {}

export interface StravaDeps {
  fetch: typeof fetch
  now: () => number
  /** Persists a refreshed connection. */
  saveConnection: (connection: StravaConnection) => Promise<void>
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { id?: number; firstname?: string; lastname?: string }
}

function isTokenResponse(data: unknown): data is TokenResponse {
  const d = data as Partial<TokenResponse> | null
  return !!d && typeof d.access_token === 'string' && typeof d.refresh_token === 'string' && typeof d.expires_at === 'number'
}

async function readJson(response: Response): Promise<unknown> {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

/** True when the OAuth functions are reachable. Under plain `vite dev` they
 *  aren't (a POST to /api/* 404s); under `vercel dev` or in production an
 *  empty POST gets the function's own JSON validation error back. */
export async function isOAuthBackendAvailable(fetchFn: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchFn('/api/strava/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const data = (await readJson(res)) as { error?: string } | null
    return res.status === 400 && typeof data?.error === 'string'
  } catch {
    return false
  }
}

export async function exchangeCode(code: string, fetchFn: typeof fetch = fetch): Promise<StravaConnection> {
  const res = await fetchFn('/api/strava/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  const data = await readJson(res)
  if (!res.ok || !isTokenResponse(data)) throw new Error(`Token exchange failed (${res.status})`)
  const name = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ').trim()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteName: name || 'Strava athlete',
    athleteId: data.athlete?.id,
  }
}

export async function refreshConnection(connection: StravaConnection, deps: StravaDeps): Promise<StravaConnection> {
  const res = await deps.fetch('/api/strava/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: connection.refreshToken }),
  })
  const data = await readJson(res)
  if (res.status === 401) throw new StravaAuthError('Strava refresh token rejected')
  if (!res.ok || !isTokenResponse(data)) throw new Error(`Token refresh failed (${res.status})`)
  const refreshed: StravaConnection = {
    ...connection,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    needsReconnect: false,
  }
  await deps.saveConnection(refreshed)
  return refreshed
}

/** Recent runs (last 14 days) straight from the Strava API. Refreshes the
 *  access token first when it has expired, and once more on a 401. */
export async function fetchRecentRuns(connection: StravaConnection, deps: StravaDeps): Promise<StravaActivity[]> {
  let current = connection
  let refreshed = false
  if (tokenNeedsRefresh(current, deps.now())) {
    current = await refreshConnection(current, deps)
    refreshed = true
  }
  const after = Math.floor(deps.now() / 1000) - STRAVA_LOOKBACK_DAYS * 86_400
  const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`

  let res = await deps.fetch(url, { headers: { Authorization: `Bearer ${current.accessToken}` } })
  if (res.status === 401 && !refreshed) {
    current = await refreshConnection(current, deps)
    res = await deps.fetch(url, { headers: { Authorization: `Bearer ${current.accessToken}` } })
  }
  if (res.status === 401) throw new StravaAuthError('Strava rejected the access token')
  if (!res.ok) throw new Error(`Strava activities request failed (${res.status})`)
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('Unexpected Strava activities response')
  return data.map(toStravaActivity).filter((a): a is StravaActivity => a !== null)
}
