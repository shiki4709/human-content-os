import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateAllPlatforms } from '@/lib/content-engine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLATFORMS: ('linkedin' | 'x')[] = ['linkedin', 'x']

async function generateWithRetry(
  sourceContent: string,
  sourceTitle: string,
  platforms: ('linkedin' | 'x')[],
  baseVoice?: string
): Promise<Record<string, string>> {
  try {
    return await generateAllPlatforms(sourceContent, sourceTitle, platforms, baseVoice)
  } catch {
    // Wait 5s then retry once
    await new Promise((resolve) => setTimeout(resolve, 5000))
    return await generateAllPlatforms(sourceContent, sourceTitle, platforms, baseVoice)
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find sources that have no matching generated_content entry
  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('id, user_id, label, content')
    .not('content', 'is', null)

  if (sourcesError) {
    console.error('Failed to fetch sources:', sourcesError)
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 })
  }

  if (!sources || sources.length === 0) {
    return NextResponse.json({ message: 'No sources found', generated: 0 })
  }

  // Find source_ids that already have generated content
  const { data: existingGenerated } = await supabase
    .from('generated_content')
    .select('source_id')
    .not('source_id', 'is', null)

  const generatedSourceIds = new Set(
    (existingGenerated || []).map((g: { source_id: string }) => g.source_id)
  )

  // Filter to only sources without any generated content
  const pendingSources = sources.filter(
    (s: { id: string }) => !generatedSourceIds.has(s.id)
  )

  if (pendingSources.length === 0) {
    return NextResponse.json({ message: 'All sources already processed', generated: 0 })
  }

  let generated = 0

  for (const source of pendingSources) {
    // Get the user's base_voice from user_settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('base_voice')
      .eq('user_id', source.user_id)
      .single()

    const baseVoice = settings?.base_voice || undefined

    try {
      const results = await generateWithRetry(
        source.content,
        source.label || 'Untitled',
        PLATFORMS,
        baseVoice
      )

      // Insert a generated_content row per platform
      const inserts = PLATFORMS.map((platform) => ({
        user_id: source.user_id,
        source_id: source.id,
        platform,
        content: results[platform],
        status: 'pending_review',
      }))

      await supabase.from('generated_content').insert(inserts)

      generated++
    } catch (error) {
      console.error(`Generation failed for source ${source.id}:`, error)

      // Store failure rows per platform
      const failureInserts = PLATFORMS.map((platform) => ({
        user_id: source.user_id,
        source_id: source.id,
        platform,
        content: '',
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
      }))

      await supabase.from('generated_content').insert(failureInserts).catch((e) => {
        console.error('Failed to store failure record:', e)
      })
    }
  }

  return NextResponse.json({ generated, pending: pendingSources.length })
}
