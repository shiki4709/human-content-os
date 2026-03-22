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

export default function AngleSelector({ title, summary, angles, totalPieces, onGenerate, onCancel, generating }: Props) {
  // Default: select all angles with all their platforms
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    for (const angle of angles) {
      init[angle.id] = [...angle.platforms]
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
          {angles.length} angles found &middot; up to {totalPieces} content pieces
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
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
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {angle.platforms.map((platform) => {
                      const pInfo = PLATFORM_LABELS[platform] || { icon: '📝', color: '#666' }
                      const isSelected = (selected[angle.id] || []).includes(platform)
                      return (
                        <button
                          key={platform}
                          onClick={() => togglePlatform(angle.id, platform)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                            border: `1.5px solid ${isSelected ? pInfo.color : 'var(--border)'}`,
                            backgroundColor: isSelected ? `${pInfo.color}10` : 'transparent',
                            color: isSelected ? pInfo.color : 'var(--text3)',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {pInfo.icon} {platform === 'linkedin' ? 'LinkedIn' : 'X'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

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
