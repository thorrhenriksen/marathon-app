// Exchanges a Strava refresh token for a new access token. Stateless
// pass-through like token.ts: stores nothing, never logs tokens or secrets.

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const TOKEN_PATTERN = /^[A-Za-z0-9]{1,256}$/

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request): Promise<Response> {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return json(500, { error: 'not_configured' })

  let refreshToken: unknown
  try {
    refreshToken = ((await request.json()) as { refresh_token?: unknown })?.refresh_token
  } catch {
    return json(400, { error: 'invalid_body' })
  }
  if (typeof refreshToken !== 'string' || !TOKEN_PATTERN.test(refreshToken)) {
    return json(400, { error: 'invalid_refresh_token' })
  }

  let upstream: Response
  try {
    upstream = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
  } catch {
    console.error('strava token refresh: upstream unreachable')
    return json(502, { error: 'upstream_unreachable' })
  }

  if (!upstream.ok) {
    console.error(`strava token refresh: upstream status ${upstream.status}`)
    // 401 tells the client the grant is gone (revoked / invalid) and it must reconnect.
    return json(upstream.status >= 500 ? 502 : 401, { error: 'refresh_failed' })
  }

  const data = (await upstream.json()) as { access_token?: string; refresh_token?: string; expires_at?: number }
  if (!data.access_token || !data.refresh_token || typeof data.expires_at !== 'number') {
    return json(502, { error: 'malformed_upstream' })
  }
  return json(200, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  })
}
