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

// Skeleton shimmer card for loading state
function SkeletonCard() {
  return (
    <div className="bg-bg2 rounded-2xl border border-border p-6 mb-4">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/5 rounded-md bg-bg3 [background:linear-gradient(90deg,var(--bg3)_25%,var(--border)_50%,var(--bg3)_75%)] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          <div className="h-3 w-1/4 rounded-md bg-bg3 [background:linear-gradient(90deg,var(--bg3)_25%,var(--border)_50%,var(--bg3)_75%)] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-bg3 [background:linear-gradient(90deg,var(--bg3)_25%,var(--border)_50%,var(--bg3)_75%)] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        ))}
      </div>
    </div>
  )
}

// Analyzing animation
function AnalyzingBar({ url }: { url: string }) {
  return (
    <div className="bg-bg2 rounded-2xl border border-border px-5 py-4 mb-4 flex items-center gap-4">
      <div className="w-8 h-8 rounded-lg bg-text flex items-center justify-center flex-shrink-0">
        <span className="w-4 h-4 rounded-full border-2 border-bg/30 border-t-bg animate-spin-fast block" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text">Analyzing article…</p>
        <p className="text-xs text-text3 truncate mt-0.5">{url}</p>
      </div>
      {/* Progress shimmer bar */}
      <div className="hidden sm:block w-24 h-1.5 rounded-full overflow-hidden bg-bg3">
        <div className="h-full w-1/2 rounded-full bg-text/30 [background:linear-gradient(90deg,transparent_0%,var(--text)_50%,transparent_100%)] bg-[length:200%_100%] animate-[shimmer_1.2s_ease-in-out_infinite]" />
      </div>
    </div>
  )
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
  const [activeSourceIdx, setActiveSourceIdx] = useState(0)

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

  async function handleDeleteContent(id: string) {
    const res = await fetch('/api/review-content/delete-one', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setItems((prev) =>
        prev
          .map((group) => ({
            ...group,
            content: group.content.filter((c) => c.id !== id),
          }))
          // Remove the whole group if no content rows remain
          .filter((group) => group.content.length > 0)
      )
    }
  }

  async function handleRegenerate(id: string) {
    // Find which content row this is so we can get source + platform
    const item = items.flatMap((i) => i.content).find((c) => c.id === id)
    const group = items.find((i) => i.content.some((c) => c.id === id))
    if (!item || !group) return

    // Get the source URL from the source meta
    const sourceMeta = group.source.meta as Record<string, unknown> | null
    const url = (sourceMeta?.url as string) ?? null
    if (!url) return

    // Build the angle from source meta (best-effort)
    const angle = {
      id: (sourceMeta?.angle_id as string) ?? 'regen',
      title: group.source.label,
      type: (sourceMeta?.angle_type as string) ?? 'insight',
      description: '',
      hook: '',
      platforms: [item.platform],
    }

    // Delete the old row first
    await fetch('/api/review-content/delete-one', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })

    // Remove from local state optimistically
    setItems((prev) =>
      prev.map((g) => ({
        ...g,
        content: g.content.filter((c) => c.id !== id),
      }))
    )

    // Re-generate
    await fetch('/api/generate-angle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, angle, platform: item.platform }),
    })

    // Refresh full list so new row appears
    await fetchItems()
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

  const anyPlatformEnabled = Object.values(platforms).some(Boolean)

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="font-serif text-xl text-text tracking-tight">Human</span>
          <a
            href="/dashboard/settings"
            className="text-sm text-text2 font-medium hover:text-text transition-colors duration-150"
          >
            Settings
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 pt-8 pb-16">

        {/* === URL INPUT SECTION === */}
        <section className="mb-8">
          {/* Platform toggles */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-text3 font-medium mr-1">Generate for:</span>
            {[
              { id: 'linkedin', label: 'LinkedIn', activeClass: 'border-linkedin bg-linkedin/5 text-linkedin', inactiveClass: 'border-border text-text3 hover:border-border2 hover:text-text2' },
              { id: 'x', label: 'X', activeClass: 'border-xblack bg-xblack/5 text-xblack', inactiveClass: 'border-border text-text3 hover:border-border2 hover:text-text2' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatforms((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 select-none',
                  platforms[p.id] ? p.activeClass : p.inactiveClass,
                ].join(' ')}
              >
                {p.id === 'linkedin' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                )}
                {p.label}
              </button>
            ))}
          </div>

          {/* URL input card */}
          <div className={[
            'rounded-2xl border transition-all duration-200',
            urlError ? 'border-red/40 bg-redl/30' : 'border-border bg-bg2',
          ].join(' ')}>
            <div className="flex items-center gap-0 p-1.5">
              {/* URL icon */}
              <div className="pl-3 pr-2 text-text3 flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <input
                type="url"
                placeholder="Paste an article URL to generate content…"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value)
                  setUrlError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                disabled={addingUrl}
                className="flex-1 py-3 pr-2 bg-transparent text-text text-sm placeholder:text-text3 outline-none font-[inherit] disabled:opacity-50"
              />
              <button
                onClick={handleAddUrl}
                disabled={!urlInput.trim() || addingUrl || !anyPlatformEnabled}
                className={[
                  'flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                  urlInput.trim() && !addingUrl && anyPlatformEnabled
                    ? 'bg-text text-bg hover:opacity-90 active:scale-[0.97] cursor-pointer'
                    : 'bg-bg3 text-text3 cursor-not-allowed',
                ].join(' ')}
              >
                Analyze
              </button>
            </div>
          </div>

          {/* Error message */}
          {urlError && (
            <div className="flex items-center gap-2 mt-2.5 px-1">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red flex-shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-red font-medium">{urlError}</p>
            </div>
          )}

          {/* Platform warning */}
          {!anyPlatformEnabled && (
            <p className="text-xs text-gold font-medium mt-2.5 px-1">
              Select at least one platform to generate content.
            </p>
          )}
        </section>

        {/* Analyzing in-progress state */}
        {addingUrl && <AnalyzingBar url={urlInput} />}

        {/* Angle selector (after analysis) */}
        {analysis && (
          <div className="mb-6 animate-fade-up">
            <AngleSelector
              title={analysis.title}
              summary={analysis.summary}
              angles={analysis.angles}
              totalPieces={analysis.totalPieces}
              onGenerate={handleGenerateAngles}
              onCancel={() => { setAnalysis(null); setUrlInput('') }}
              generating={generating}
            />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : items.length === 0 && !analysis ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-bg2 border border-border flex items-center justify-center mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text3">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-text mb-1.5">No content yet</h2>
            <p className="text-sm text-text2 max-w-xs leading-relaxed">
              Paste any article or newsletter URL above to get started.
            </p>
          </div>
        ) : items.length > 0 ? (
          <div>
            {/* Source tabs — show when multiple sources */}
            {items.length > 1 && (
              <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
                {items.map((item, idx) => {
                  const label = item.source.label.split(' — ')[0].slice(0, 30)
                  const count = item.content.length
                  const allDone = item.content.every((c) => c.status === 'published')
                  return (
                    <button
                      key={item.source.id}
                      onClick={() => setActiveSourceIdx(idx)}
                      className={[
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border whitespace-nowrap transition-all duration-150',
                        idx === activeSourceIdx
                          ? 'border-accent bg-accent/5 text-accent'
                          : allDone
                            ? 'border-green/20 bg-green/5 text-green'
                            : 'border-border text-text3 hover:border-border2 hover:text-text2',
                      ].join(' ')}
                    >
                      {allDone && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {label}{label.length >= 30 ? '…' : ''} ({count})
                    </button>
                  )
                })}
              </div>
            )}

            {/* Active source card */}
            {items[activeSourceIdx] && (
              <ContentCard
                source={items[activeSourceIdx].source}
                content={items[activeSourceIdx].content}
                onPublish={handlePublish}
                onRefine={handleRefine}
                onDelete={async (id) => {
                  await handleDelete(id)
                  if (activeSourceIdx >= items.length - 1 && activeSourceIdx > 0) {
                    setActiveSourceIdx(activeSourceIdx - 1)
                  }
                }}
                onDeleteContent={handleDeleteContent}
                onRegenerate={handleRegenerate}
              />
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
