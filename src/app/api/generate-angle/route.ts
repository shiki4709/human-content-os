import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateForAngle, type ContentAngle } from '@/lib/content-engine'

// Same content fetching logic
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

async function fetchArticleContent(url: string): Promise<{ title: string; content: string }> {
  const isSubstack = url.includes('substack.com') || url.includes('.substack.')
  if (isSubstack) {
    try {
      const slugMatch = url.match(/\/p\/([^/?#]+)/)
      const domainMatch = url.match(/https?:\/\/([^/]+)/)
      if (slugMatch && domainMatch) {
        const apiUrl = `https://${domainMatch[1]}/api/v1/posts/${slugMatch[1]}`
        const apiRes = await fetch(apiUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        })
        if (apiRes.ok) {
          const post = await apiRes.json()
          if (post.body_html) {
            const text = htmlToText(post.body_html)
            if (text.length > 200) return { title: post.title || 'Untitled', content: text.slice(0, 15000) }
          }
        }
      }
    } catch { /* fall through */ }
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  })
  const rawHtml = await res.text()
  const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
  let content = ''
  const articleMatch = rawHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) content = htmlToText(articleMatch[1])
  if (!content || content.length < 200) { const m = rawHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i); if (m) content = htmlToText(m[1]) }
  if (!content || content.length < 200) content = htmlToText(rawHtml)
  return { title: titleMatch?.[1]?.trim() || 'Untitled', content: content.slice(0, 15000) }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { url, angle, platform } = await request.json() as {
    url: string
    angle: ContentAngle
    platform: string
  }

  if (!url || !angle || !platform) {
    return NextResponse.json({ error: 'url, angle, and platform are required' }, { status: 400 })
  }

  const { title, content: sourceContent } = await fetchArticleContent(url)

  // Get base voice
  const { data: settings } = await supabase
    .from('user_settings')
    .select('base_voice')
    .eq('user_id', user.id)
    .single()

  const generated = await generateForAngle(
    sourceContent, title, angle, platform, settings?.base_voice
  )

  // Store source if not exists
  const { data: existingSource } = await supabase
    .from('sources')
    .select('id')
    .eq('user_id', user.id)
    .contains('meta', { url })
    .limit(1)

  let sourceId: string
  if (existingSource && existingSource.length > 0) {
    sourceId = existingSource[0].id
  } else {
    const { data: newSource } = await supabase
      .from('sources')
      .insert({
        user_id: user.id,
        type: 'url',
        label: `${title} — ${angle.title}`,
        content: sourceContent.slice(0, 10000),
        meta: { url, angle_id: angle.id, angle_type: angle.type },
        selected: true,
      })
      .select()
      .single()
    sourceId = newSource?.id
  }

  // Store generated content
  const { data: contentRow } = await supabase
    .from('generated_content')
    .insert({
      user_id: user.id,
      platform,
      content: generated,
      status: 'pending_review',
      source_id: sourceId,
    })
    .select()
    .single()

  return NextResponse.json({ success: true, content: contentRow })
}
