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

const VIRAL_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High viral potential', color: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.1)' },
  medium: { label: 'Good fit', color: 'rgb(234, 179, 8)', bg: 'rgba(234, 179, 8, 0.1)' },
  low: { label: 'Lower fit', color: 'var(--text3)', bg: 'var(--bg)' },
}

const PLATFORM_LABELS: Record<string, { icon: string; color: string }> = {
  linkedin: { icon: '🔵', color: '#0a66c2' },
  x: { icon: '⬛', color: '#000' },
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
    <div style={{
      backgroundColor: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1.25rem',
    }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
          {title}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: '0.5rem' }}>
          {summary}
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--accent)', fontWeight: 600 }}>
          {angles.length} angles found &middot; {selectedCount} selected to generate
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {angles.map((angle) => {
          const typeInfo = TYPE_LABELS[angle.type] || { emoji: '📝', label: angle.type }
          const isAnySelected = (selected[angle.id] || []).length > 0

          return (
            <div
              key={angle.id}
              style={{
                padding: '1rem',
                borderRadius: '10px',
                border: `1px solid ${isAnySelected ? 'var(--accent)' : 'var(--border)'}`,
                backgroundColor: isAnySelected ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg2)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{typeInfo.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                      {angle.title}
                    </span>
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px',
                      backgroundColor: 'var(--bg)', color: 'var(--text3)', border: '1px solid var(--border)',
                    }}>
                      {typeInfo.label}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: '1.4', marginBottom: '0.625rem' }}>
                    {angle.summary}
                  </p>

                  {/* Platform buttons with viral score */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {angle.platforms.map((platform) => {
                      const pInfo = PLATFORM_LABELS[platform] || { icon: '📝', color: '#666' }
                      const isSelected = (selected[angle.id] || []).includes(platform)
                      const viral = getViralScore(angle.type, platform)
                      const badge = VIRAL_BADGE[viral]
                      return (
                        <button
                          key={platform}
                          onClick={() => togglePlatform(angle.id, platform)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                            border: `1.5px solid ${isSelected ? pInfo.color : 'var(--border)'}`,
                            backgroundColor: isSelected ? `${pInfo.color}10` : 'transparent',
                            color: isSelected ? pInfo.color : 'var(--text3)',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {pInfo.icon} {platform === 'linkedin' ? 'LinkedIn' : 'X'}
                          {viral === 'high' && (
                            <span style={{
                              fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px',
                              backgroundColor: badge.bg, color: badge.color, fontWeight: 700,
                            }}>
                              REC
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Delete angle button */}
                <button
                  onClick={() => removeAngle(angle.id)}
                  title="Remove this angle"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 6px', color: 'var(--text3)', fontSize: '0.875rem',
                    lineHeight: 1, flexShrink: 0,
                  }}
                >
                  &#x2715;
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {angles.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem', padding: '1rem 0' }}>
          All angles removed. Click Cancel to start over.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onCancel}
          disabled={generating}
          style={{
            padding: '0.75rem 1.25rem', borderRadius: '8px',
            border: '1px solid var(--border)', backgroundColor: 'transparent',
            color: 'var(--text2)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onGenerate(selections)}
          disabled={selectedCount === 0 || generating}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none',
            backgroundColor: selectedCount > 0 && !generating ? 'var(--accent)' : 'var(--border)',
            color: selectedCount > 0 && !generating ? '#fff' : 'var(--text3)',
            fontSize: '0.875rem', fontWeight: 600,
            cursor: selectedCount > 0 && !generating ? 'pointer' : 'not-allowed',
          }}
        >
          {generating ? 'Generating...' : `Generate ${selectedCount} piece${selectedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
