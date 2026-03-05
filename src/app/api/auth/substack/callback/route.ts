import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/platforms/substack'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const cookieStore = cookies()
  const savedState = cookieStore.get('substack_oauth_state')?.value

  if (error || !code || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/dashboard?tab=publish&oauth_error=substack`)
  }

  try {
    const tokenData = await exchangeCode(code)

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                )
              } catch {}
            },
          },
        }
      )

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('platform_connections')
          .delete()
          .eq('user_id', user.id)
          .eq('platform', 'substack')

        await supabase.from('platform_connections').insert({
          user_id: user.id,
          platform: 'substack',
          access_token: tokenData.access_token,
          refresh_token: null,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          meta: {},
        })
      }
    }

    cookieStore.delete('substack_oauth_state')
    return NextResponse.redirect(`${APP_URL}/dashboard?tab=publish&connected=substack`)
  } catch (err) {
    console.error('Substack OAuth error:', err)
    return NextResponse.redirect(`${APP_URL}/dashboard?tab=publish&oauth_error=substack`)
  }
}
