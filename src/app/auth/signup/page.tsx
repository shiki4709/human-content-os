'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          brand_voice: brandVoice,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleGoogleSignup() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg2">
      <div className="w-full max-w-[400px] mx-4">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl tracking-tight text-text">Human</h1>
          <p className="text-text3 text-sm mt-1">content OS</p>
        </div>

        <div className="bg-bg rounded-2xl border border-border p-6 shadow-sm">
          {step === 1 ? (
            <>
              <h2 className="font-serif text-xl mb-1">Create your account</h2>
              <p className="text-text3 text-[13px] mb-5">Start turning sources into content</p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-redl text-red text-[13px] border border-red/20">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text3 mb-1.5 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent placeholder:text-text3"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text3 mb-1.5 block">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent placeholder:text-text3"
                    required
                    minLength={6}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!email || !password) { setError('Fill in email and password'); return }
                    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
                    setError('')
                    setStep(2)
                  }}
                  className="mt-1 w-full py-2.5 rounded-lg bg-text text-bg font-semibold text-[13.5px] transition-all hover:bg-[#2a2926] shadow-sm"
                >
                  Continue
                </button>
              </div>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-text3">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                onClick={handleGoogleSignup}
                className="w-full py-2.5 rounded-lg border border-border bg-bg text-text2 font-medium text-[13px] transition-all hover:bg-bg2 hover:border-border2 flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
            </>
          ) : (
            <form onSubmit={handleSignup}>
              <h2 className="font-serif text-xl mb-1">Set up your brand voice</h2>
              <p className="text-text3 text-[13px] mb-5">
                This helps us generate content that sounds like you. You can change it later.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-redl text-red text-[13px] border border-red/20">
                  {error}
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text3 mb-1.5 block">
                  Brand voice
                </label>
                <textarea
                  value={brandVoice}
                  onChange={e => setBrandVoice(e.target.value)}
                  rows={3}
                  placeholder='e.g. AI startup founder, building for Asian markets, ex-fintech, speaks to other founders…'
                  className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-3 py-2.5 outline-none transition-colors focus:border-accent placeholder:text-text3 resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-lg border border-border bg-bg text-text2 font-medium text-[13px] transition-all hover:bg-bg2"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg bg-text text-bg font-semibold text-[13.5px] transition-all hover:bg-[#2a2926] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-[13px] text-text3 mt-4">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-accent font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
