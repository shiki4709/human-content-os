import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateAllPlatforms } from '@/lib/content-engine'

const P0_PLATFORMS = ['linkedin', 'x'] as const

// Strip HTML to clean text (same as sources/route.ts)
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// Fetch content — tries Substack API first for clean article body
async function fetchArticleContent(url: string): Promise<{ title: string; content: string }> {
  const isSubstack = url.includes('substack.com') || url.includes('.substack.')

  // Try Substack API for clean content
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
            if (text.length > 200) {
              return {
                title: post.title || 'Untitled',
                content: text.slice(0, 15000),
              }
            }
          }
        }
      }
    } catch {
      // Fall through to regular fetch
    }
  }

  // Regular fetch fallback
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const rawHtml = await res.text()

  const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled'

  // Try to extract just the article content
  let content = ''
  const articleMatch = rawHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) {
    content = htmlToText(articleMatch[1])
  }
  if (!content || content.length < 200) {
    // Try main tag
    const mainMatch = rawHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (mainMatch) {
      content = htmlToText(mainMatch[1])
    }
  }
  if (!content || content.length < 200) {
    // Fallback to full page
    content = htmlToText(rawHtml)
  }

  return { title, content: content.slice(0, 15000) }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { url } = await request.json()
  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  // Dedup check
  const { data: existing } = await supabase
    .from('sources')
    .select('id')
    .eq('user_id', user.id)
    .contains('meta', { url })
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: 'Already processed', source_id: existing[0].id })
  }

  // Fetch article content
  let title: string
  let content: string
  try {
    const result = await fetchArticleContent(url)
    title = result.title
    content = result.content
  } catch {
    return NextResponse.json({ error: 'Could not fetch URL' }, { status: 400 })
  }

  if (content.length < 100) {
    return NextResponse.json({ error: 'Not enough content found at this URL' }, { status: 400 })
  }

  // Create source
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .insert({
      user_id: user.id,
      type: 'url',
      label: title,
      content: content.slice(0, 10000), // Cap at 10k chars
      meta: { url },
      selected: true,
    })
    .select()
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Failed to save source' }, { status: 500 })
  }

  // Get user's base voice
  const { data: settings } = await supabase
    .from('user_settings')
    .select('base_voice')
    .eq('user_id', user.id)
    .single()

  // Generate content for all platforms
  try {
    const results = await generateAllPlatforms(
      content.slice(0, 10000),
      title,
      P0_PLATFORMS,
      settings?.base_voice,
    )

    for (const platform of P0_PLATFORMS) {
      await supabase.from('generated_content').insert({
        user_id: user.id,
        platform,
        content: results[platform] || '',
        status: 'pending_review',
        source_id: source.id,
      })
    }

    return NextResponse.json({ success: true, source_id: source.id })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to generate content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
