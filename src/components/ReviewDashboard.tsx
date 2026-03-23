'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Source, GeneratedContent } from '@/types'
import type { ContentAngle } from '@/lib/content-engine'
import ContentCard from './ContentCard'
import AngleSelector from './AngleSelector'

interface ReviewItem {
  source: Source
  content: GeneratedContent[]
}

interface AnalysisState {
  url: string
  title: string
  summary: string
  angles: ContentAngle[]
  totalPieces: number
}

export default function ReviewDashboard() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null)
  const [generating, setGenerating] = useState(false)
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({ linkedin: true, x: true })

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
    setAnalysis(null)
    try {
      const enabledPlatforms = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k)
      const res = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (res.ok) {
        const data = await res.json()
        // Filter angle platforms to only user's selected ones
        const filteredAngles = (data.analysis.angles as ContentAngle[]).map((a) => ({
          ...a,
          platforms: a.platforms.filter((p) => enabledPlatforms.includes(p)),
        })).filter((a) => a.platforms.length > 0)
        setAnalysis({
          url,
          title: data.title,
          summary: data.analysis.article_summary,
          angles: filteredAngles,
          totalPieces: filteredAngles.reduce((sum, a) => sum + a.platforms.length, 0),
        })
      } else {
        const data = await res.json()
        setUrlError(data.error ?? 'Failed to analyze URL')
      }
    } catch {
      setUrlError('Network error — please try again')
    } finally {
      setAddingUrl(false)
    }
  }

  async function handleGenerateAngles(selections: { angle: ContentAngle; platform: string }[]) {
    if (!analysis) return
    setGenerating(true)
    try {
      for (const { angle, platform } of selections) {
        await fetch('/api/generate-angle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: analysis.url, angle, platform }),
        })
      }
      setAnalysis(null)
      setUrlInput('')
      await fetchItems()
    } catch {
      setUrlError('Failed to generate some content')
    } finally {
      setGenerating(false)
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
          href="/dashboard/settings"
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
        {/* Platform toggles */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            { id: 'linkedin', label: 'LinkedIn', icon: '🔵' },
            { id: 'x', label: 'X', icon: '⬛' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatforms((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                border: `1.5px solid ${platforms[p.id] ? 'var(--accent)' : 'var(--border)'}`,
                backgroundColor: platforms[p.id] ? 'rgba(79, 70, 229, 0.06)' : 'transparent',
                color: platforms[p.id] ? 'var(--accent)' : 'var(--text3)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

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
              {addingUrl ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          {urlError && (
            <p style={{ color: 'rgb(239,68,68)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              {urlError}
            </p>
          )}
        </div>

        {/* Angle selector (after analysis) */}
        {analysis && (
          <AngleSelector
            title={analysis.title}
            summary={analysis.summary}
            angles={analysis.angles}
            totalPieces={analysis.totalPieces}
            onGenerate={handleGenerateAngles}
            onCancel={() => { setAnalysis(null); setUrlInput('') }}
            generating={generating}
          />
        )}

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
