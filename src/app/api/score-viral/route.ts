import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { scoreVirality } from '@/lib/content-engine'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { content, platform } = await request.json()
  if (!content || !platform) {
    return NextResponse.json({ error: 'content and platform are required' }, { status: 400 })
  }

  const score = await scoreVirality(content, platform)
  return NextResponse.json({ score })
}
