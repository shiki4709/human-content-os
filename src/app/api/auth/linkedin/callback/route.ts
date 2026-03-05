import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, getUserInfo } from '@/lib/platforms/linkedin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const cookieStore = cookies()
  const savedState = cookieStore.get('linkedin_oauth_state')?.value

  if (error || !code || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/dashboard?tab=publish&oauth_error=linkedin`)
  }

  try {
    const tokenData = await exchangeCode(code)
    const userInfo = await getUserInfo(tokenData.access_token)

    // Store in Supabase if configured
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
        // Delete existing connection then insert new one
        await supabase.from('platform_connections')
          .delete()
          .eq('user_id', user.id)
          .eq('platform', 'linkedin')

        await supabase.from('platform_connections').insert({
          user_id: user.id,
          platform: 'linkedin',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          meta: { sub: userInfo.sub, name: userInfo.name },
        })
      }
    }

    cookieStore.delete('linkedin_oauth_state')
    return NextResponse.redirect(`${APP_URL}/dashboard?tab=publish&connected=linkedin`)
  } catch (err) {
    console.error('LinkedIn OAuth error:', err)
    return NextResponse.redirect(`${APP_URL}/dashboard?tab=publish&oauth_error=linkedin`)
  }
}
