// Substack does not have a broadly available public API.
// This module provides the OAuth skeleton for future use.
// Currently, Substack operates in copy-only mode.

export function isConfigured(): boolean {
  return !!(process.env.SUBSTACK_CLIENT_ID && process.env.SUBSTACK_CLIENT_SECRET)
}

export function getRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/substack/callback`
}

export function getAuthUrl(state: string): string {
  // Placeholder — Substack Partner API OAuth URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SUBSTACK_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    state,
    scope: 'write',
  })
  return `https://substack.com/oauth/authorize?${params.toString()}`
}

export async function exchangeCode(code: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const res = await fetch('https://substack.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: process.env.SUBSTACK_CLIENT_ID!,
      client_secret: process.env.SUBSTACK_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`Substack token exchange failed: ${res.status}`)
  return res.json()
}
