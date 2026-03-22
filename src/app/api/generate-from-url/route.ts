import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { fetchFullContent, stripHtmlToText } from '@/lib/rss'
import { generateAllPlatforms } from '@/lib/content-engine'

const P0_PLATFORMS = ['linkedin', 'x'] as const

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { url } = await request.json()
  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  // Dedup: check if this URL already has a source
  const { data: existing } = await supabase
    .from('sources')
    .select('id')
    .eq('user_id', user.id)
    .or(`rss_guid.eq.${url},meta->>url.eq.${url}`)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: 'Already processed', source_id: existing[0].id })
  }

  // Fetch content from URL
  let content: string
  let title = 'Untitled'
  try {
    const rawHtml = await fetch(url, { headers: { 'User-Agent': 'HumanContentOS/1.0' } }).then(r => r.text())

    // Extract title from HTML
    const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) title = titleMatch[1].trim()

    content = stripHtmlToText(rawHtml)

    if (content.length < 100) {
      content = await fetchFullContent(url)
    }
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
