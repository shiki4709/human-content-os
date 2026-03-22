'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Source, GeneratedContent } from '@/types'
import ContentCard from './ContentCard'

interface ReviewItem {
  source: Source
  content: GeneratedContent[]
}

export default function ReviewDashboard() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/review-content')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items ?? [])
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  async function handleAddUrl() {
    const url = urlInput.trim()
    if (!url) return
    setAddingUrl(true)
    setUrlError(null)
    try {
      const res = await fetch('/api/generate-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (res.ok) {
        setUrlInput('')
        await fetchItems()
      } else {
        const data = await res.json()
        setUrlError(data.error ?? 'Failed to process URL')
      }
    } catch {
      setUrlError('Network error — please try again')
    } finally {
      setAddingUrl(false)
    }
  }

  async function handlePublish(id: string) {
    // Find the content item to get platform
    const item = items.flatMap((i) => i.content).find((c) => c.id === id)
    if (!item) return

    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: item.platform, content: item.content }),
    })

    if (res.ok) {
      // Update local state: mark as published
      setItems((prev) =>
        prev.map((group) => ({
          ...group,
          content: group.content.map((c) =>
            c.id === id ? { ...c, status: 'published' as const } : c
          ),
        }))
      )
    }
  }

  async function handleDelete(sourceId: string) {
    const res = await fetch('/api/review-content/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: sourceId }),
    })
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.source.id !== sourceId))
    }
  }

  async function handleRefine(id: string, instruction: string) {
    const item = items.flatMap((i) => i.content).find((c) => c.id === id)
    if (!item) return

    const res = await fetch('/api/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: item.platform,
        content: item.content,
        instruction,
        isThread: item.platform === 'x',
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setItems((prev) =>
        prev.map((group) => ({
          ...group,
          content: group.content.map((c) =>
            c.id === id ? { ...c, content: data.content } : c
          ),
        }))
      )
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
          }}
        >
          Human
        </span>
        <a
          href="/settings"
          style={{
            fontSize: '0.875rem',
            color: 'var(--text2)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Settings
        </a>
      </header>

      <main
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '2rem 1.5rem',
        }}
      >
        {/* URL input bar */}
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
            }}
          >
            <input
              type="url"
              placeholder="Paste a URL to generate content…"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value)
                setUrlError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
              style={{
                flex: 1,
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg2)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleAddUrl}
              disabled={!urlInput.trim() || addingUrl}
              style={{
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: urlInput.trim() && !addingUrl ? 'var(--accent)' : 'var(--border)',
                color: urlInput.trim() && !addingUrl ? '#fff' : 'var(--text3)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: urlInput.trim() && !addingUrl ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              {addingUrl ? 'Processing…' : '+ URL'}
            </button>
          </div>
          {urlError && (
            <p style={{ color: 'rgb(239,68,68)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              {urlError}
            </p>
          )}
        </div>

        {/* Content list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text3)' }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '5rem 2rem',
              color: 'var(--text3)',
            }}
          >
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text2)' }}>
              No content yet
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              Paste any article or post link above to get started.
            </p>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <ContentCard
                key={item.source.id}
                source={item.source}
                content={item.content}
                onPublish={handlePublish}
                onRefine={handleRefine}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
