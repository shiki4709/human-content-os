import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENCLAW_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENCLAW_API_KEY not configured' },
        { status: 503 }
      )
    }

    const { platform, content, action } = await request.json()
    if (!content || !platform) {
      return NextResponse.json(
        { error: 'content and platform are required' },
        { status: 400 }
      )
    }

    // Call OpenClaw browser automation API
    const res = await fetch('https://api.openclaw.com/v1/post', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform,
        content,
        action: action || 'post',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json(
        { error: `OpenClaw API error: ${err}` },
        { status: res.status }
      )
    }

    const result = await res.json()

    // Persist to Supabase
    let userId = 'dev'
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
      if (user) userId = user.id

      try {
        await supabase.from('publish_log').insert({
          user_id: userId,
          platform,
          content,
          status: 'auto-posted',
          platform_post_id: result.post_id || null,
        })
      } catch {}
    }

    const entry = {
      id: crypto.randomUUID(),
      user_id: userId,
      platform,
      content,
      status: 'auto-posted',
      platform_post_id: result.post_id || null,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({ entry })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
