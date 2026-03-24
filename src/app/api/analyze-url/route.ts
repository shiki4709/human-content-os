import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { analyzeArticle } from '@/lib/content-engine'

// Same content fetching logic as generate-from-url
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
            if (text.length > 200) {
              return { title: post.title || 'Untitled', content: text.slice(0, 15000) }
            }
          }
        }
      }
    } catch { /* fall through */ }
  }

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

  let content = ''
  const articleMatch = rawHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) content = htmlToText(articleMatch[1])
  if (!content || content.length < 200) {
    const mainMatch = rawHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (mainMatch) content = htmlToText(mainMatch[1])
  }
  if (!content || content.length < 200) content = htmlToText(rawHtml)

  return { title, content: content.slice(0, 15000) }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { url } = await request.json()
  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

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
    return NextResponse.json({ error: 'Not enough content found' }, { status: 400 })
  }

  const analysis = await analyzeArticle(content, title)

  return NextResponse.json({
    title,
    content_length: content.length,
    content_preview: content.slice(0, 200),
    analysis,
  })
}
