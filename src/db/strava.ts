// Dexie I/O for the Strava integration. Everything here is best-effort and
// non-blocking: failures are logged and swallowed so the app never waits on
// (or breaks because of) Strava. Tokens and activities live only on-device.

import { db } from './db'
import {
  EMPTY_STRAVA_STATE,
  StravaAuthError,
  buildAuthorizeUrl,
  exchangeCode,
  fetchRecentRuns,
  isOAuthBackendAvailable,
  shouldFetch,
  stravaRedirectUri,
  STRAVA_SCOPE,
  type OAuthCallback,
} from '../lib/strava'
import type { StravaConnection, StravaState } from '../types'

declare const __STRAVA_CLIENT_ID__: string

export function stravaClientId(): string {
  return typeof __STRAVA_CLIENT_ID__ === 'string' ? __STRAVA_CLIENT_ID__ : ''
}

export async function getStravaState(): Promise<StravaState> {
  return (await db.strava.get('strava')) ?? { ...EMPTY_STRAVA_STATE }
}

async function updateStravaState(mutate: (state: StravaState) => StravaState): Promise<void> {
  await db.transaction('rw', db.strava, async () => {
    const current = await getStravaState()
    await db.strava.put(mutate(current))
  })
}

/** Starts the OAuth redirect. Navigates in the same window on purpose: in an
 *  iOS home-screen PWA, window.open would hand off to Safari (whose storage
 *  is separate from the PWA's), whereas same-window navigation stays in the
 *  standalone web view and returns to the app at the redirect URI. */
export async function beginStravaConnect(): Promise<string | null> {
  if (!(await isOAuthBackendAvailable())) {
    return 'Strava sign-in isn’t available here (the OAuth functions only run under `vercel dev` or in production).'
  }
  const clientId = stravaClientId()
  if (!clientId) return 'Strava isn’t configured for this build.'
  const state = crypto.randomUUID()
  await updateStravaState((s) => ({ ...s, pendingOAuthState: state }))
  window.location.assign(buildAuthorizeUrl(clientId, stravaRedirectUri(window.location.origin), state))
  return null
}

/** Handles the redirect landing. Returns a user-facing message. */
export async function completeStravaConnect(callback: OAuthCallback): Promise<{ ok: boolean; message: string }> {
  const state = await getStravaState()
  const expectedState = state.pendingOAuthState
  await updateStravaState((s) => ({ ...s, pendingOAuthState: undefined }))

  if (callback.error) return { ok: false, message: 'Strava connection was cancelled.' }
  if (!callback.code || !expectedState || callback.state !== expectedState) {
    return { ok: false, message: 'Strava connection couldn’t be verified. Please try again.' }
  }
  if (!(callback.scope ?? '').split(',').includes(STRAVA_SCOPE)) {
    return { ok: false, message: 'Strava needs permission to read your activities. Please try again and keep that box ticked.' }
  }
  try {
    const connection = await exchangeCode(callback.code)
    await updateStravaState((s) => ({ ...s, connection, lastFetchAttemptAt: undefined }))
    return { ok: true, message: `Connected as ${connection.athleteName}.` }
  } catch (err) {
    console.warn('Strava: code exchange failed', err instanceof Error ? err.message : err)
    return { ok: false, message: 'Couldn’t finish connecting to Strava. Please try again.' }
  }
}

/** Wipes tokens and the cached activities (so no cards linger). Imported and
 *  ignored ids are kept so reconnecting never resurfaces handled runs. */
export async function disconnectStrava(): Promise<void> {
  const { connection } = await getStravaState()
  await updateStravaState((s) => ({
    ...s,
    connection: undefined,
    recentActivities: [],
    lastFetchAttemptAt: undefined,
    pendingOAuthState: undefined,
  }))
  // Best-effort revoke so the app also disappears from the athlete's Strava settings.
  if (connection) {
    fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    }).catch((err) => console.warn('Strava: deauthorize failed', err instanceof Error ? err.message : err))
  }
}

let inFlight: Promise<void> | null = null

/** Fetches recent runs into the on-device cache. Throttled to once per 30
 *  minutes unless forced (pull-to-refresh, just connected). Never throws. */
export function syncStravaActivities({ force = false }: { force?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const state = await getStravaState()
      if (!state.connection || state.connection.needsReconnect) return
      if (!force && !shouldFetch(state, Date.now())) return
      await updateStravaState((s) => ({ ...s, lastFetchAttemptAt: new Date().toISOString() }))
      const activities = await fetchRecentRuns(state.connection, {
        fetch: (...args) => fetch(...args),
        now: () => Date.now(),
        saveConnection: (connection: StravaConnection) =>
          updateStravaState((s) => (s.connection ? { ...s, connection } : s)),
      })
      await updateStravaState((s) => (s.connection ? { ...s, recentActivities: activities } : s))
    } catch (err) {
      console.warn('Strava: sync failed', err instanceof Error ? err.message : err)
      if (err instanceof StravaAuthError) {
        await updateStravaState((s) =>
          s.connection ? { ...s, connection: { ...s.connection, needsReconnect: true } } : s,
        )
      }
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

export async function markStravaActivityImported(activityId: number): Promise<void> {
  await updateStravaState((s) =>
    s.importedActivityIds.includes(activityId)
      ? s
      : { ...s, importedActivityIds: [...s.importedActivityIds, activityId] },
  )
}

export async function ignoreStravaActivity(activityId: number): Promise<void> {
  await updateStravaState((s) =>
    s.ignoredActivityIds.includes(activityId)
      ? s
      : { ...s, ignoredActivityIds: [...s.ignoredActivityIds, activityId] },
  )
}

/** Link-instead-of-create: attaches the activity to an existing manual run. */
export async function linkStravaActivityToRun(activityId: number, runId: string): Promise<void> {
  await db.transaction('rw', db.runs, db.strava, async () => {
    await db.runs.update(runId, { stravaActivityId: activityId })
    await markStravaActivityImported(activityId)
  })
}
