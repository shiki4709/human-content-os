const X_AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const X_TWEETS_URL = 'https://api.twitter.com/2/tweets'

export function isConfigured(): boolean {
  return !!(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET)
}

export function getRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/x/callback`
}

// PKCE helpers
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64url(array)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64url(new Uint8Array(digest))
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach(b => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function getAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${X_AUTH_URL}?${params.toString()}`
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const credentials = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier,
    }),
  })
  if (!res.ok) throw new Error(`X token exchange failed: ${res.status}`)
  return res.json()
}

export async function postThread(accessToken: string, tweets: string[]): Promise<{ ids: string[] }> {
  const ids: string[] = []
  let previousId: string | null = null

  for (const text of tweets) {
    const body: Record<string, unknown> = { text: text.slice(0, 280) }
    if (previousId) {
      body.reply = { in_reply_to_tweet_id: previousId }
    }

    const res = await fetch(X_TWEETS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`X tweet failed: ${res.status} ${err}`)
    }

    const data = await res.json()
    previousId = data.data.id
    ids.push(data.data.id)
  }

  return { ids }
}
