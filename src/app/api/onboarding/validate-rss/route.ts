import { NextRequest, NextResponse } from 'next/server'
import { fetchSubstackRSS } from '@/lib/rss'

export async function POST(request: NextRequest) {
  let url: string

  try {
    const body = await request.json()
    url = body.url
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ valid: false, error: 'URL is required' }, { status: 400 })
  }

  // Normalize URL: strip trailing slash, then add /feed if missing
  let normalized = url.trim().replace(/\/$/, '')

  // If the URL doesn't end in /feed, append it
  if (!normalized.endsWith('/feed')) {
    normalized = `${normalized}/feed`
  }

  // Ensure protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`
  }

  try {
    const items = await fetchSubstackRSS(normalized)

    if (!items || items.length === 0) {
      return NextResponse.json({ valid: false, error: 'No posts found in feed' })
    }

    const latestPost = items[0]

    return NextResponse.json({
      valid: true,
      rssUrl: normalized,
      postCount: items.length,
      latestPost: {
        title: latestPost.title,
        link: latestPost.link,
        pubDate: latestPost.pubDate,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch RSS feed'
    return NextResponse.json({ valid: false, error: message })
  }
}
