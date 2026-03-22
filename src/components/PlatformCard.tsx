'use client'

import { useState } from 'react'
import type { GeneratedContent } from '@/types'

interface PlatformCardProps {
  content: GeneratedContent
  onPublish: (id: string) => Promise<void>
  onRefine: (id: string, instruction: string) => Promise<void>
}

const PLATFORM_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  linkedin: {
    label: 'LinkedIn',
    color: '#0a66c2',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  x: {
    label: 'X',
    color: '#000000',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
}

function TweetCard({ text, index }: { text: string; index: number }) {
  return (
    <div
      style={{
        padding: '0.75rem',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg)',
        marginBottom: '0.5rem',
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text3)',
          marginBottom: '0.35rem',
          fontWeight: 500,
        }}
      >
        {index + 1}
      </div>
      <p style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
        {text}
      </p>
    </div>
  )
}

export default function PlatformCard({ content, onPublish, onRefine }: PlatformCardProps) {
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState(content.content)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [refining, setRefining] = useState(false)

  const meta = PLATFORM_META[content.platform] ?? {
    label: content.platform,
    color: '#666',
    icon: null,
  }

  const isX = content.platform === 'x'
  const tweets = isX
    ? content.content.split(/\n?---\n?/).map((t) => t.trim()).filter(Boolean)
    : []

  const [copied, setCopied] = useState(false)

  async function handlePublish() {
    setPublishing(true)
    try {
      // Copy content to clipboard
      const textToCopy = isX
        ? tweets.join('\n\n')
        : content.content
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)

      // Open platform in new tab
      if (content.platform === 'linkedin') {
        window.open('https://www.linkedin.com/feed/', '_blank')
      } else if (content.platform === 'x') {
        // Pre-fill first tweet if possible
        const firstTweet = tweets[0] || content.content.slice(0, 280)
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(firstTweet)}`, '_blank')
      }

      await onPublish(content.id)
    } finally {
      setPublishing(false)
    }
  }

  async function handleRefine() {
    if (!refineInstruction.trim()) return
    setRefining(true)
    try {
      await onRefine(content.id, refineInstruction)
      setRefineInstruction('')
    } finally {
      setRefining(false)
    }
  }

  const isPublished = content.status === 'published'
  const isFailed = content.status === 'failed'

  return (
    <div
      style={{
        backgroundColor: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.875rem 1rem',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              backgroundColor: meta.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {meta.icon}
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.875rem' }}>
            {meta.label}
          </span>
        </div>

        {/* Status badge */}
        {isPublished && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgb(34,197,94)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: '0.75rem', color: 'rgb(34,197,94)', fontWeight: 600 }}>
              Published
            </span>
          </div>
        )}
        {isFailed && (
          <div
            style={{
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'rgb(239,68,68)', fontWeight: 600 }}>
              Failed
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '1rem' }}>
        {editing ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            style={{
              width: '100%',
              minHeight: '180px',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        ) : isX && tweets.length > 1 ? (
          <div>
            {tweets.map((tweet, i) => (
              <TweetCard key={i} text={tweet} index={i} />
            ))}
          </div>
        ) : (
          <p
            style={{
              color: 'var(--text)',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}
          >
            {content.content}
          </p>
        )}

        {/* Error message */}
        {isFailed && content.error_message && (
          <p style={{ color: 'rgb(239,68,68)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {content.error_message}
          </p>
        )}

        {/* Refine bar (shown while editing) */}
        {editing && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '0.75rem',
            }}
          >
            <input
              type="text"
              placeholder="Refine: make it punchier, add a hook…"
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '0.8rem',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleRefine}
              disabled={!refineInstruction.trim() || refining}
              style={{
                padding: '0.5rem 0.875rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: refineInstruction.trim() && !refining ? 'var(--accent)' : 'var(--border)',
                color: refineInstruction.trim() && !refining ? '#fff' : 'var(--text3)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: refineInstruction.trim() && !refining ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              {refining ? '…' : 'Refine'}
            </button>
          </div>
        )}

        {/* Action buttons */}
        {!isPublished && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '0.875rem',
            }}
          >
            <button
              onClick={() => setEditing((v) => !v)}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: editing ? 'var(--bg3)' : 'var(--bg)',
                color: 'var(--text2)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {editing ? 'Done editing' : 'Edit'}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              style={{
                flex: 2,
                padding: '0.5rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: publishing ? 'var(--border)' : 'var(--accent)',
                color: publishing ? 'var(--text3)' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: publishing ? 'not-allowed' : 'pointer',
              }}
            >
              {publishing ? 'Copying…' : copied ? 'Copied! ✓' : `Copy & Open ${meta.label}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
