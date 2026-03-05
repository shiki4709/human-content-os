import { NextResponse } from 'next/server'
import { isConfigured, getAuthUrl } from '@/lib/platforms/linkedin'
import { cookies } from 'next/headers'

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'LinkedIn OAuth not configured' }, { status: 503 })
  }

  const state = crypto.randomUUID()
  const url = getAuthUrl(state)

  const cookieStore = cookies()
  cookieStore.set('linkedin_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  })

  return NextResponse.redirect(url)
}
