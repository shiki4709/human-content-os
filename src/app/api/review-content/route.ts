import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Source, GeneratedContent } from '@/types'

export async function GET() {
  const supabase = createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Fetch all generated_content for this user
  const { data: contentRows, error: contentError } = await supabase
    .from('generated_content')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (contentError) {
    return NextResponse.json({ error: contentError.message }, { status: 500 })
  }

  const allContent = (contentRows ?? []) as GeneratedContent[]

  // Collect unique source_ids that have generated content
  const sourceIds = [...new Set(allContent.map((c) => c.source_id).filter(Boolean))] as string[]

  if (sourceIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // Fetch the corresponding sources
  const { data: sourceRows, error: sourcesError } = await supabase
    .from('sources')
    .select('*')
    .eq('user_id', user.id)
    .in('id', sourceIds)
    .order('created_at', { ascending: false })

  if (sourcesError) {
    return NextResponse.json({ error: sourcesError.message }, { status: 500 })
  }

  const sources = (sourceRows ?? []) as Source[]

  // Group content by source, ordered by most recent source first
  const items = sources.map((source) => ({
    source,
    content: allContent.filter((c) => c.source_id === source.id),
  }))

  return NextResponse.json({ items })
}
