'use client'

import { useState } from 'react'
import type { ContentAngle } from '@/lib/content-engine'

const TYPE_LABELS: Record<string, { emoji: string; label: string }> = {
  key_insight: { emoji: '💡', label: 'Key Insight' },
  story: { emoji: '📖', label: 'Story' },
  data_point: { emoji: '📊', label: 'Data Point' },
  framework: { emoji: '🔧', label: 'Framework' },
  contrarian_take: { emoji: '🔥', label: 'Contrarian Take' },
  how_to: { emoji: '📋', label: 'How-To' },
  quote: { emoji: '💬', label: 'Quote' },
}

// Which angle types perform best on which platform (based on viral content research)
const PLATFORM_RECS: Record<string, Record<string, 'high' | 'medium' | 'low'>> = {
  linkedin: {
    story: 'high',           // Personal stories get 3-5x more reach on LinkedIn
    key_insight: 'high',     // Insight-driven posts perform well
    data_point: 'high',      // Specific stats stop the scroll
    contrarian_take: 'medium', // Works but riskier on professional platform
    framework: 'medium',
    how_to: 'medium',
    quote: 'low',
  },
  x: {
    contrarian_take: 'high', // Hot takes drive replies which boost reach
    data_point: 'high',      // Surprising stats get bookmarked + reposted
    framework: 'high',       // Thread-friendly, gets saved
    how_to: 'high',          // Listicle threads perform best on X
    key_insight: 'medium',
    quote: 'medium',         // Good as standalone tweet
    story: 'low',            // Stories work less well in thread format
  },
}

function getViralScore(type: string, platform: string): 'high' | 'medium' | 'low' {
  return PLATFORM_RECS[platform]?.[type] || 'medium'
}

// Tooltip copy explaining why an angle is recommended
const REC_REASONS: Record<string, Record<string, string>> = {
  linkedin: {
    story: 'Personal stories get 3–5× more reach on LinkedIn',
    key_insight: 'Insight-driven posts consistently top LinkedIn feeds',
    data_point: 'Specific stats stop the scroll and earn saves',
  },
  x: {
    contrarian_take: 'Hot takes drive replies, which boost algorithmic reach',
    data_point: 'Surprising stats get bookmarked and reposted',
    framework: 'Thread-friendly frameworks get saved and shared',
    how_to: 'Listicle threads are the highest-performing format on X',
  },
}

function getRecReason(type: string, platform: string): string {
  return REC_REASONS[platform]?.[type] ?? 'High engagement potential on this platform'
}

interface Props {
  title: string
  summary: string
  angles: ContentAngle[]
  totalPieces: number
  onGenerate: (selections: { angle: ContentAngle; platform: string }[]) => void
  onCancel: () => void
  generating: boolean
}

export default function AngleSelector({ title, summary, angles: initialAngles, onGenerate, onCancel, generating }: Props) {
  const [angles, setAngles] = useState(initialAngles)
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    for (const angle of initialAngles) {
      // Auto-select platforms where the angle has high viral potential
      init[angle.id] = angle.platforms.filter(
        (p) => getViralScore(angle.type, p) !== 'low'
      )
    }
    return init
  })
  const [tooltip, setTooltip] = useState<string | null>(null)

  function togglePlatform(angleId: string, platform: string) {
    setSelected((prev) => {
      const current = prev[angleId] || []
      if (current.includes(platform)) {
        return { ...prev, [angleId]: current.filter((p) => p !== platform) }
      } else {
        return { ...prev, [angleId]: [...current, platform] }
      }
    })
  }

  function removeAngle(angleId: string) {
    setAngles((prev) => prev.filter((a) => a.id !== angleId))
    setSelected((prev) => {
      const next = { ...prev }
      delete next[angleId]
      return next
    })
  }

  function getSelections() {
    const result: { angle: ContentAngle; platform: string }[] = []
    for (const angle of angles) {
      const platforms = selected[angle.id] || []
      for (const platform of platforms) {
        result.push({ angle, platform })
      }
    }
    return result
  }

  const selections = getSelections()
  const selectedCount = selections.length

  return (
    <div className="bg-bg rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-bg2">
        <h3 className="text-sm font-semibold text-text leading-snug line-clamp-2 mb-1">
          {title}
        </h3>
        <p className="text-xs text-text3 leading-relaxed line-clamp-3 mb-2">
          {summary}
        </p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent bg-acl border border-acb rounded-full px-2.5 py-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            {angles.length} angles found
          </span>
          <span className="text-xs text-text3">
            {selectedCount} selected to generate
          </span>
        </div>
      </div>

      {/* Angles list */}
      <div className="p-4 space-y-3">
        {angles.map((angle) => {
          const typeInfo = TYPE_LABELS[angle.type] || { emoji: '📝', label: angle.type }
          const isAnySelected = (selected[angle.id] || []).length > 0

          return (
            <div
              key={angle.id}
              className={[
                'rounded-xl border p-4 transition-all duration-150',
                isAnySelected
                  ? 'border-border2 bg-bg2 shadow-sm'
                  : 'border-border bg-bg hover:border-border2',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                {/* Type emoji badge */}
                <div className="w-8 h-8 rounded-lg bg-bg3 flex items-center justify-center flex-shrink-0 text-sm">
                  {typeInfo.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-text leading-snug">
                      {angle.title}
                    </span>
                    <span className="text-[10px] font-semibold text-text3 bg-bg3 border border-border rounded-md px-1.5 py-0.5 uppercase tracking-wide">
                      {typeInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-text2 leading-relaxed mb-3">
                    {angle.summary}
                  </p>

                  {/* Platform buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {angle.platforms.map((platform) => {
                      const isSelected = (selected[angle.id] || []).includes(platform)
                      const viral = getViralScore(angle.type, platform)
                      const isRec = viral === 'high'
                      const recReason = getRecReason(angle.type, platform)

                      const platformStyles = {
                        linkedin: {
                          selected: 'border-linkedin bg-linkedin/5 text-linkedin',
                          idle: 'border-border text-text3 hover:border-linkedin/40 hover:text-linkedin',
                        },
                        x: {
                          selected: 'border-xblack bg-xblack/5 text-xblack',
                          idle: 'border-border text-text3 hover:border-xblack/30 hover:text-xblack',
                        },
                      }

                      const styles = platformStyles[platform as 'linkedin' | 'x'] ?? {
                        selected: 'border-accent bg-acl text-accent',
                        idle: 'border-border text-text3',
                      }

                      return (
                        <div key={platform} className="relative group">
                          <button
                            onClick={() => togglePlatform(angle.id, platform)}
                            className={[
                              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150',
                              isSelected ? styles.selected : styles.idle,
                            ].join(' ')}
                          >
                            {/* Platform icon */}
                            {platform === 'linkedin' ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                                <circle cx="4" cy="4" r="2" />
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                              </svg>
                            )}
                            {platform === 'linkedin' ? 'LinkedIn' : 'X'}

                            {/* REC badge */}
                            {isRec && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-md bg-green/10 text-green border border-green/20 cursor-help"
                                onMouseEnter={() => setTooltip(`${angle.id}-${platform}`)}
                                onMouseLeave={() => setTooltip(null)}
                              >
                                ★ REC
                              </span>
                            )}
                          </button>

                          {/* Tooltip */}
                          {isRec && tooltip === `${angle.id}-${platform}` && (
                            <div className="absolute bottom-full left-0 mb-2 z-20 w-48 bg-text text-bg text-[10px] leading-snug rounded-lg px-3 py-2 shadow-lg pointer-events-none">
                              {recReason}
                              <div className="absolute top-full left-4 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-text" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Remove angle button */}
                <button
                  onClick={() => removeAngle(angle.id)}
                  title="Remove this angle"
                  className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-text3 hover:text-text hover:bg-bg3 transition-all duration-150"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}

        {angles.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-text3">All angles removed.</p>
            <p className="text-xs text-text3 mt-1">Click Cancel to start over.</p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={onCancel}
          disabled={generating}
          className="px-4 py-2.5 rounded-xl border border-border bg-transparent text-text2 text-sm font-medium hover:border-border2 hover:text-text transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={() => onGenerate(selections)}
          disabled={selectedCount === 0 || generating}
          className={[
            'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
            selectedCount > 0 && !generating
              ? 'bg-text text-bg hover:opacity-90 active:scale-[0.98] cursor-pointer'
              : 'bg-bg3 text-text3 cursor-not-allowed',
          ].join(' ')}
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-bg/30 border-t-bg animate-spin-fast" />
              Generating…
            </span>
          ) : (
            `Generate ${selectedCount} piece${selectedCount !== 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  )
}
