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
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-fade-up">
        {/* Logotype */}
        <div className="text-center mb-10">
          <span className="font-serif text-4xl text-text tracking-tight">Human</span>
        </div>

        {/* Card */}
        <div className="bg-bg2 rounded-2xl border border-border shadow-sm px-8 py-10 text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-text flex items-center justify-center mx-auto mb-6">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-text tracking-tight mb-3">
            Welcome to Human
          </h1>
          <p className="text-text2 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
            Paste any article or post link, and Human repurposes it into ready-to-publish LinkedIn posts and X threads — in seconds.
          </p>

          {/* Feature list */}
          <ul className="text-left space-y-3 mb-8">
            {[
              { icon: '🔗', text: 'Works with any article, newsletter, or URL' },
              { icon: '🎯', text: 'Platform-native formats for LinkedIn & X' },
              { icon: '✏️', text: 'Edit and refine before you post' },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5">{item.icon}</span>
                <span className="text-sm text-text2 leading-snug">{item.text}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full py-3.5 rounded-xl bg-text text-bg text-sm font-semibold tracking-wide hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {completing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-bg/30 border-t-bg animate-spin-fast" />
                Setting up…
              </span>
            ) : (
              'Get Started →'
            )}
          </button>
        </div>

        <p className="text-center text-xs text-text3 mt-6">
          No credit card required · Cancel anytime
        </p>
      </div>
    </div>
  )
}
