import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import type { User } from '@supabase/supabase-js'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // If Supabase is not configured, render shell with a stub user for development
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const stubUser = { id: 'dev', email: 'dev@localhost' } as User
    return <DashboardShell user={stubUser}>{children}</DashboardShell>
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
