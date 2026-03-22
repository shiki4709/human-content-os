'use client'

import { useState } from 'react'

interface OnboardingFlowProps {
  onComplete: () => void
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [completing, setCompleting] = useState(false)

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
        maxWidth: '480px',
        backgroundColor: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '2.5rem',
        textAlign: 'center' as const,
      }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem' }}>
          Welcome to Human
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>
          Paste any article or post link, and Human will repurpose it into LinkedIn posts and X threads — automatically.
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
          {completing ? 'Setting up...' : 'Get Started'}
        </button>
      </div>
    </div>
  )
}
