import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isConfigured as linkedinConfigured } from '@/lib/platforms/linkedin'
import { isConfigured as xConfigured } from '@/lib/platforms/x'
import { isConfigured as substackConfigured } from '@/lib/platforms/substack'

export async function GET() {
  const configured = {
    linkedin: linkedinConfigured(),
    x: xConfigured(),
    substack: substackConfigured(),
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ connections: {}, configured })
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ connections: {}, configured })
  }

  try {
    const { data } = await supabase
      .from('platform_connections')
      .select('platform, expires_at, meta')
      .eq('user_id', user.id)

    const connections: Record<string, { connected: boolean; expired: boolean; name?: string }> = {}
    for (const row of data || []) {
      const expired = row.expires_at ? new Date(row.expires_at) < new Date() : false
      const meta = row.meta as Record<string, string> | null
      connections[row.platform] = { connected: true, expired, name: meta?.name }
    }

    return NextResponse.json({ connections, configured })
  } catch {
    return NextResponse.json({ connections: {}, configured })
  }
}

export async function DELETE(request: NextRequest) {
  const { platform } = await request.json()

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: true })
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    await supabase
      .from('platform_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', platform)
  } catch {}

  return NextResponse.json({ success: true })
}
