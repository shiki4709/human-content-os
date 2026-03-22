'use client'

import { useState, useEffect } from 'react'
import OnboardingFlow from '@/components/OnboardingFlow'
import ReviewDashboard from '@/components/ReviewDashboard'
import type { UserSettings } from '@/types'

type LoadState = 'loading' | 'onboarding' | 'dashboard'

export default function DashboardPage() {
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          const settings = data.settings as UserSettings | null
          if (settings?.onboarding_complete) {
            setState('dashboard')
          } else {
            setState('onboarding')
          }
        } else {
          // Not authenticated or error — show onboarding
          setState('onboarding')
        }
      } catch {
        setState('onboarding')
      }
    }

    checkOnboarding()
  }, [])

  if (state === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg)',
          color: 'var(--text3)',
          fontSize: '0.875rem',
        }}
      >
        Loading…
      </div>
    )
  }

  if (state === 'onboarding') {
    return <OnboardingFlow onComplete={() => setState('dashboard')} />
  }

  return <ReviewDashboard />
}
