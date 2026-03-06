import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publishPost } from '@/lib/platforms/linkedin'
import { postThread } from '@/lib/platforms/x'

const COPY_ONLY = ['rednote', 'notejp', 'instagram']

function parseXThread(content: string): string[] {
  const parts = content.split(/TWEET_\d+:\s*/i).filter(t => t.trim())
  if (parts.length > 1) return parts.map(t => t.split('|')[0].trim()).filter(Boolean)
  const byPipe = content.split('|').map(t => t.trim()).filter(t => t.length > 10)
  if (byPipe.length > 1) return byPipe
  const byDash = content.split(/\n---\n/).map(t => t.trim()).filter(Boolean)
  if (byDash.length > 1) return byDash
  const byNum = content.split(/\n\d+[/.]\s*/).filter(t => t.trim())
  if (byNum.length > 1) return byNum
  const words = content.split(' ')
  const tweets: string[] = []
  let cur = ''
  words.forEach(w => {
    if ((cur + ' ' + w).length > 260) { tweets.push(cur.trim()); cur = w }
    else cur = cur ? cur + ' ' + w : w
  })
  if (cur) tweets.push(cur.trim())
  return tweets.filter(Boolean)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { platform, content } = body as { platform: string; content: string }

  if (!platform || !content) {
    return NextResponse.json({ error: 'Platform and content required' }, { status: 400 })
  }

  // Build Supabase client
  let supabase = null
  let userId = 'dev'

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const cookieStore = cookies()
    supabase = createServerClient(
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
  }

  // Copy-only platforms: just log as draft
  if (COPY_ONLY.includes(platform)) {
    const entry = await logPublish(supabase, userId, platform, content, 'draft', null)
    return NextResponse.json({ status: 'draft', entry })
  }

  // OAuth platforms: need a connection
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { data: conn } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single()

  if (!conn) {
    return NextResponse.json({ error: 'Not connected', code: 'NOT_CONNECTED' }, { status: 401 })
  }

  if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired — reconnect', code: 'TOKEN_EXPIRED' }, { status: 401 })
  }

  try {
    let platformPostId: string | null = null

    if (platform === 'linkedin') {
      const meta = conn.meta as Record<string, string> | null
      const authorUrn = `urn:li:person:${meta?.sub}`
      const result = await publishPost(conn.access_token, authorUrn, content)
      platformPostId = result.id
    } else if (platform === 'x') {
      const tweets = parseXThread(content)
      const result = await postThread(conn.access_token, tweets)
      platformPostId = result.ids[0]
    } else if (platform === 'substack') {
      // Substack: log as draft (no public API)
      const entry = await logPublish(supabase, userId, platform, content, 'draft', null)
      return NextResponse.json({ status: 'draft', entry })
    }

    const entry = await logPublish(supabase, userId, platform, content, 'published', platformPostId)
    return NextResponse.json({ status: 'published', entry, platformPostId })
  } catch (err) {
    console.error(`Publish to ${platform} failed:`, err)
    const message = err instanceof Error ? err.message : 'Publish failed'
    return NextResponse.json({ error: message, code: 'PUBLISH_FAILED' }, { status: 500 })
  }
}

async function logPublish(
  supabase: ReturnType<typeof createServerClient> | null,
  userId: string,
  platform: string,
  content: string,
  status: string,
  platformPostId: string | null,
) {
  const entry = {
    id: crypto.randomUUID(),
    user_id: userId,
    platform,
    content,
    status,
    platform_post_id: platformPostId,
    created_at: new Date().toISOString(),
  }

  if (supabase) {
    try {
      await supabase.from('publish_log').insert({
        id: entry.id,
        user_id: userId,
        platform,
        content,
        status,
        platform_post_id: platformPostId,
      })
    } catch {}
  }

  return entry
}
