// Exchanges a Strava OAuth authorization code for access + refresh tokens.
// Stateless pass-through: holds the client secret so it never reaches the
// browser, stores nothing, and never logs tokens or secrets. No activity
// data passes through here — the app fetches activities directly from
// Strava with the returned bearer token.

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const CODE_PATTERN = /^[A-Za-z0-9]{1,256}$/

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

  let code: unknown
  try {
    code = ((await request.json()) as { code?: unknown })?.code
  } catch {
    return json(400, { error: 'invalid_body' })
  }
  if (typeof code !== 'string' || !CODE_PATTERN.test(code)) return json(400, { error: 'invalid_code' })

  let upstream: Response
  try {
    upstream = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })
  } catch {
    console.error('strava token exchange: upstream unreachable')
    return json(502, { error: 'upstream_unreachable' })
  }

  if (!upstream.ok) {
    console.error(`strava token exchange: upstream status ${upstream.status}`)
    return json(upstream.status >= 500 ? 502 : 400, { error: 'exchange_failed' })
  }

  const data = (await upstream.json()) as {
    access_token?: string
    refresh_token?: string
    expires_at?: number
    athlete?: { id?: number; firstname?: string; lastname?: string }
  }
  if (!data.access_token || !data.refresh_token || typeof data.expires_at !== 'number') {
    return json(502, { error: 'malformed_upstream' })
  }
  // Only the token fields and the athlete's display name go back to the client.
  return json(200, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: {
      id: data.athlete?.id,
      firstname: data.athlete?.firstname ?? '',
      lastname: data.athlete?.lastname ?? '',
    },
  })
}
