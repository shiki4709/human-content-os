const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts'

export function isConfigured(): boolean {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
}

export function getRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/linkedin/callback`
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    state,
    scope: 'openid profile w_member_social',
  })
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`
}

export async function exchangeCode(code: string): Promise<{
  access_token: string
  expires_in: number
  refresh_token?: string
}> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${res.status}`)
  return res.json()
}

export async function getUserInfo(accessToken: string): Promise<{ sub: string; name: string }> {
  const res = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`LinkedIn userinfo failed: ${res.status}`)
  return res.json()
}

export async function publishPost(accessToken: string, authorUrn: string, content: string): Promise<{ id: string }> {
  const res = await fetch(LINKEDIN_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202401',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
      },
      commentary: content,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LinkedIn publish failed: ${res.status} ${err}`)
  }
  const id = res.headers.get('x-restli-id') || crypto.randomUUID()
  return { id }
}
