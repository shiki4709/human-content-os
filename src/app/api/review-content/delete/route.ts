import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { source_id } = await request.json()
  if (!source_id) return NextResponse.json({ error: 'source_id required' }, { status: 400 })

  // Delete generated content for this source
  await supabase
    .from('generated_content')
    .delete()
    .eq('source_id', source_id)
    .eq('user_id', user.id)

  // Delete the source itself
  await supabase
    .from('sources')
    .delete()
    .eq('id', source_id)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
