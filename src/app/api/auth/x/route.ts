import { NextResponse } from 'next/server'
import { isConfigured, getAuthUrl, generateCodeVerifier, generateCodeChallenge } from '@/lib/platforms/x'
import { cookies } from 'next/headers'

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'X OAuth not configured' }, { status: 503 })
  }

  const state = crypto.randomUUID()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const url = getAuthUrl(state, codeChallenge)

  const cookieStore = cookies()
  cookieStore.set('x_oauth', JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  })

  return NextResponse.redirect(url)
}
