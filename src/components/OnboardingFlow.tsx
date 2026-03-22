'use client'

import { useState } from 'react'

interface OnboardingFlowProps {
  onComplete: () => void
}

interface ValidateResult {
  valid: boolean
  rssUrl?: string
  postCount?: number
  latestPost?: { title: string }
  error?: string
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 state
  const [substackUrl, setSubstackUrl] = useState('')
  const [validating, setValidating] = useState(false)
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null)
  const [completing, setCompleting] = useState(false)

  async function handleCheckFeed() {
    if (!substackUrl.trim()) return
    setValidating(true)
    setValidateResult(null)
    try {
      const res = await fetch('/api/onboarding/validate-rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: substackUrl.trim() }),
      })
      const data: ValidateResult = await res.json()
      setValidateResult(data)
      if (data.valid && data.rssUrl) {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ substack_rss_url: data.rssUrl }),
        })
      }
    } catch {
      setValidateResult({ valid: false, error: 'Network error' })
    } finally {
      setValidating(false)
    }
  }

  async function handleComplete() {
    setCompleting(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_complete: true }),
      })
    } catch {}
    setCompleting(false)
    onComplete()
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '2.5rem',
      }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem' }}>
          {[1, 2].map((s) => (
            <div key={s} style={{
              flex: 1, height: '4px', borderRadius: '2px',
              backgroundColor: s <= step ? 'var(--accent)' : 'var(--border)',
              transition: 'background-color 0.2s',
            }} />
          ))}
        </div>

        {/* Step 1: Connect everything */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
              Connect your accounts
            </h1>
            <p style={{ color: 'var(--text2)', marginBottom: '2rem', fontSize: '0.95rem' }}>
              Human watches your Substack and auto-repurposes posts to LinkedIn and X.
            </p>

            {/* Substack */}
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Source
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="url"
                placeholder="https://yourname.substack.com"
                value={substackUrl}
                onChange={(e) => { setSubstackUrl(e.target.value); setValidateResult(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckFeed()}
                style={{
                  flex: 1, padding: '0.75rem 1rem', borderRadius: '8px',
                  border: '1px solid var(--border)', backgroundColor: 'var(--bg)',
                  color: 'var(--text)', fontSize: '0.95rem', outline: 'none',
                }}
              />
              <button
                onClick={handleCheckFeed}
                disabled={!substackUrl.trim() || validating}
                style={{
                  padding: '0.75rem 1.25rem', borderRadius: '8px', border: 'none',
                  backgroundColor: substackUrl.trim() && !validating ? 'var(--accent)' : 'var(--border)',
                  color: substackUrl.trim() && !validating ? '#fff' : 'var(--text3)',
                  fontWeight: 600, fontSize: '0.875rem', cursor: substackUrl.trim() && !validating ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {validating ? '...' : 'Check'}
              </button>
            </div>

            {validateResult && (
              <div style={{
                padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem',
                backgroundColor: validateResult.valid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${validateResult.valid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}>
                {validateResult.valid ? (
                  <p style={{ color: 'rgb(34, 197, 94)', fontSize: '0.875rem', fontWeight: 500 }}>
                    Found {validateResult.postCount} post{validateResult.postCount !== 1 ? 's' : ''}
                    {validateResult.latestPost && <> &middot; Latest: <em>{validateResult.latestPost.title}</em></>}
                  </p>
                ) : (
                  <p style={{ color: 'rgb(239, 68, 68)', fontSize: '0.875rem' }}>{validateResult.error}</p>
                )}
              </div>
            )}

            {/* Publish destinations */}
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem', marginTop: validateResult ? '0' : '0.75rem' }}>
              Destinations
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
              <a href="/api/auth/linkedin" style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.875rem', borderRadius: '10px', border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)', textDecoration: 'none', transition: 'border-color 0.15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0a66c2')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" /><circle cx="4" cy="4" r="2" /></svg>
                </div>
                <div>
                  <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>LinkedIn</div>
                  <div style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>Connect</div>
                </div>
              </a>

              <a href="/api/auth/x" style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.875rem', borderRadius: '10px', border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)', textDecoration: 'none', transition: 'border-color 0.15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#000')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </div>
                <div>
                  <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>X</div>
                  <div style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>Connect</div>
                </div>
              </a>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!validateResult?.valid}
              style={{
                width: '100%', padding: '0.875rem', borderRadius: '8px', border: 'none',
                backgroundColor: validateResult?.valid ? 'var(--accent)' : 'var(--border)',
                color: validateResult?.valid ? '#fff' : 'var(--text3)',
                fontWeight: 600, fontSize: '0.95rem',
                cursor: validateResult?.valid ? 'pointer' : 'not-allowed',
              }}
            >
              Continue
            </button>
            <p style={{ color: 'var(--text3)', fontSize: '0.75rem', textAlign: 'center' as const, marginTop: '0.75rem' }}>
              You can connect platforms later in Settings
            </p>
          </div>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
          <div style={{ textAlign: 'center' as const }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgb(34, 197, 94)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem' }}>
              You&apos;re all set!
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>
              Human is watching your Substack. When you publish a new post, repurposed versions will appear here automatically.
            </p>

            <button
              onClick={handleComplete}
              disabled={completing}
              style={{
                width: '100%', padding: '0.875rem', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--accent)', color: '#fff',
                fontWeight: 600, fontSize: '1rem',
                cursor: completing ? 'not-allowed' : 'pointer',
                opacity: completing ? 0.7 : 1,
              }}
            >
              {completing ? 'Setting up...' : 'Go to Dashboard'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
