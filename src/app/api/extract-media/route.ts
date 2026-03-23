import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface ExtractedImage {
  url: string
  source: 'og' | 'twitter' | 'article'
  alt?: string
}

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href
  } catch {
    return relative
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { url } = await request.json()
  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch {
    return NextResponse.json({ error: 'Could not fetch URL' }, { status: 400 })
  }

  const images: ExtractedImage[] = []
  const seen = new Set<string>()

  function addImage(imgUrl: string, source: ExtractedImage['source'], alt?: string) {
    if (!imgUrl) return
    const resolved = resolveUrl(url, imgUrl)
    if (!seen.has(resolved) && resolved.startsWith('http')) {
      seen.add(resolved)
      images.push({ url: resolved, source, ...(alt ? { alt } : {}) })
    }
  }

  // og:image
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (ogMatch) addImage(ogMatch[1], 'og')

  // twitter:image
  const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
  if (twMatch) addImage(twMatch[1], 'twitter')

  // First large <img> inside <article> or <main>
  const containers = ['article', 'main']
  for (const tag of containers) {
    const containerMatch = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
    if (containerMatch) {
      const imgMatch = containerMatch[1].match(/<img[^>]+>/i)
      if (imgMatch) {
        const srcMatch = imgMatch[0].match(/src=["']([^"']+)["']/i)
        const altMatch = imgMatch[0].match(/alt=["']([^"']*)["']/i)
        if (srcMatch) {
          addImage(srcMatch[1], 'article', altMatch?.[1])
          break
        }
      }
    }
  }

  return NextResponse.json({ images })
}
