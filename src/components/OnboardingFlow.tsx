'use client'

import { useState } from 'react'

interface OnboardingFlowProps {
  onComplete: () => void
}

type Step = 1 | 2 | 3

interface LatestPost {
  title: string
  link: string
  pubDate?: string
}

interface ValidateResult {
  valid: boolean
  rssUrl?: string
  postCount?: number
  latestPost?: LatestPost
  error?: string
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>(1)

  // Step 1 state
  const [substackUrl, setSubstackUrl] = useState('')
  const [validating, setValidating] = useState(false)
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null)

  // Step 3 state
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
        // Persist the validated RSS URL to settings
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rss_url: data.rssUrl }),
        })
      }
    } catch {
      setValidateResult({ valid: false, error: 'Network error — please try again' })
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
    } catch {
      // Non-fatal — proceed anyway
    } finally {
      setCompleting(false)
      onComplete()
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '2.5rem',
        }}
      >
        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem' }}>
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: s <= step ? 'var(--accent)' : 'var(--border)',
                transition: 'background-color 0.2s',
              }}
            />
          ))}
        </div>

        {/* Step 1: Substack URL */}
        {step === 1 && (
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '0.5rem',
              }}
            >
              Connect your Substack
            </h1>
            <p style={{ color: 'var(--text2)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
              Enter your Substack URL and we'll pull in your posts automatically.
            </p>

            <label
              htmlFor="substack-url"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--text2)',
                marginBottom: '0.5rem',
              }}
            >
              Substack URL
            </label>
            <input
              id="substack-url"
              type="url"
              placeholder="https://yourname.substack.com"
              value={substackUrl}
              onChange={(e) => {
                setSubstackUrl(e.target.value)
                setValidateResult(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCheckFeed()}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '0.75rem',
              }}
            />

            <button
              onClick={handleCheckFeed}
              disabled={!substackUrl.trim() || validating}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: substackUrl.trim() && !validating ? 'var(--accent)' : 'var(--border)',
                color: substackUrl.trim() && !validating ? '#fff' : 'var(--text3)',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: substackUrl.trim() && !validating ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.15s',
              }}
            >
              {validating ? 'Checking…' : 'Check Feed'}
            </button>

            {/* Validation feedback */}
            {validateResult && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.875rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: validateResult.valid
                    ? 'rgba(34, 197, 94, 0.08)'
                    : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${validateResult.valid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}
              >
                {validateResult.valid ? (
                  <>
                    <p
                      style={{
                        color: 'rgb(34, 197, 94)',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      Feed found — {validateResult.postCount} post{validateResult.postCount !== 1 ? 's' : ''}
                    </p>
                    {validateResult.latestPost && (
                      <p style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>
                        Latest: <em>{validateResult.latestPost.title}</em>
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ color: 'rgb(239, 68, 68)', fontSize: '0.875rem' }}>
                    {validateResult.error ?? 'Could not validate feed'}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!validateResult?.valid}
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                color: validateResult?.valid ? 'var(--text)' : 'var(--text3)',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: validateResult?.valid ? 'pointer' : 'not-allowed',
              }}
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 2: Connect Platforms */}
        {step === 2 && (
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '0.5rem',
              }}
            >
              Connect platforms
            </h1>
            <p style={{ color: 'var(--text2)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
              Connect LinkedIn and X to publish directly from the dashboard.
            </p>

            {/* LinkedIn */}
            <a
              href="/api/auth/linkedin"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                textDecoration: 'none',
                marginBottom: '0.75rem',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.borderColor = '#0a66c2')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)')
              }
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#0a66c2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem' }}>
                  Connect LinkedIn
                </div>
                <div style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>
                  Publish posts directly to your profile
                </div>
              </div>
              <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>→</span>
            </a>

            {/* X / Twitter */}
            <a
              href="/api/auth/x"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                textDecoration: 'none',
                marginBottom: '1.5rem',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.borderColor = '#000')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)')
              }
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem' }}>
                  Connect X
                </div>
                <div style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>
                  Post threads directly to your account
                </div>
              </div>
              <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>→</span>
            </a>

            <button
              onClick={() => setStep(3)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                marginBottom: '0.5rem',
              }}
            >
              Continue →
            </button>
            <button
              onClick={() => setStep(3)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text3)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgb(34, 197, 94)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '0.5rem',
              }}
            >
              You're all set!
            </h1>
            <p
              style={{
                color: 'var(--text2)',
                fontSize: '0.95rem',
                marginBottom: '2rem',
                lineHeight: '1.6',
              }}
            >
              Your Substack is connected and your dashboard is ready. Start reviewing posts and publishing to your audience.
            </p>

            <button
              onClick={handleComplete}
              disabled={completing}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: completing ? 'not-allowed' : 'pointer',
                opacity: completing ? 0.7 : 1,
              }}
            >
              {completing ? 'Setting up…' : 'Go to Dashboard'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
