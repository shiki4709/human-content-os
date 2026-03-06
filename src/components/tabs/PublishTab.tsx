'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PublishEntry, PlatformConnection } from '@/types'
import { toast } from '@/components/Toast'

type Props = {
  onNavigate: (tab: 'sources' | 'repurpose' | 'configure' | 'generate' | 'publish') => void
  generatedContent: Record<string, string>
  enabledPlatforms: Record<string, boolean>
  onConnectionsChange: (connected: Record<string, boolean>) => void
}

const hasOpenClawKey = process.env.NEXT_PUBLIC_OPENCLAW_CONFIGURED === 'true'

const PLAT_META: Record<string, { icon: string; name: string; color: string; oauth: boolean }> = {
  linkedin: { icon: '💼', name: 'LinkedIn', color: 'bg-[#0a66c2]', oauth: true },
  x: { icon: '𝕏', name: 'X / Twitter', color: 'bg-[#000]', oauth: true },
  substack: { icon: '📧', name: 'Substack', color: 'bg-[#ff6719]', oauth: true },
  rednote: { icon: '🌸', name: 'Rednote 小红书', color: 'bg-[#ff2442]', oauth: false },
  notejp: { icon: '📝', name: 'Note.jp', color: 'bg-[#41c9b4]', oauth: false },
  instagram: { icon: '📸', name: 'Instagram', color: 'bg-[#e1306c]', oauth: false },
}

const COPY_ONLY = ['rednote', 'notejp', 'instagram']

export default function PublishTab({
  onNavigate,
  generatedContent,
  enabledPlatforms,
  onConnectionsChange,
}: Props) {
  const [connections, setConnections] = useState<Record<string, PlatformConnection>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [publishLog, setPublishLog] = useState<PublishEntry[]>([])
  const [publishing, setPublishing] = useState<Record<string, boolean>>({})
  const [oauthTarget, setOauthTarget] = useState<string | null>(null)

  // Fetch connections + config on mount
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/connections')
      const data = await res.json()
      setConnections(data.connections || {})
      setConfigured(data.configured || {})
      // Notify parent of connection status
      const connected: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(data.connections || {})) {
        connected[k] = (v as PlatformConnection).connected
      }
      onConnectionsChange(connected)
    } catch {}
  }, [onConnectionsChange])

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch('/api/publish-log')
      const data = await res.json()
      setPublishLog(data.entries || [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchConnections()
    fetchLog()
  }, [fetchConnections, fetchLog])

  // Detect OAuth return from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const oauthError = params.get('oauth_error')

    if (connected) {
      const name = PLAT_META[connected]?.name || connected
      toast(`Connected ${name}`)
      fetchConnections()
      window.history.replaceState({}, '', '/dashboard')
    }
    if (oauthError) {
      const name = PLAT_META[oauthError]?.name || oauthError
      toast(`Failed to connect ${name} — try again`)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [fetchConnections])

  // Connect flow
  function handleConnect(platform: string) {
    if (!configured[platform]) {
      toast(`${PLAT_META[platform]?.name} OAuth not configured — add credentials to .env.local`)
      return
    }
    setOauthTarget(platform)
  }

  function handleDisconnect(platform: string) {
    fetch('/api/connections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    }).then(() => {
      const updated = { ...connections }
      delete updated[platform]
      setConnections(updated)
      onConnectionsChange(
        Object.fromEntries(Object.entries(updated).map(([k, v]) => [k, v.connected]))
      )
      toast(`Disconnected ${PLAT_META[platform]?.name}`)
    })
  }

  function doOAuth(platform: string) {
    setOauthTarget(null)
    window.location.href = `/api/auth/${platform}`
  }

  // Publish / copy flow
  async function handlePublish(platform: string) {
    const content = generatedContent[platform]
    if (!content) {
      toast('No content to publish — generate first')
      return
    }

    // Copy-only platforms
    if (COPY_ONLY.includes(platform)) {
      try {
        await navigator.clipboard.writeText(content)
      } catch {
        toast('Could not copy to clipboard')
        return
      }

      setPublishing(p => ({ ...p, [platform]: true }))
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, content }),
        })
        const data = await res.json()
        if (data.entry) {
          setPublishLog(prev => [data.entry, ...prev])
        }
      } catch {}
      setPublishing(p => ({ ...p, [platform]: false }))

      const name = PLAT_META[platform]?.name || platform
      toast(`Copied — open ${name} and create a draft`)
      return
    }

    // OAuth platforms
    const conn = connections[platform]
    if (!conn?.connected) {
      handleConnect(platform)
      return
    }

    if (conn.expired) {
      toast(`${PLAT_META[platform]?.name} token expired — reconnect`)
      handleConnect(platform)
      return
    }

    setPublishing(p => ({ ...p, [platform]: true }))
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, content }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'TOKEN_EXPIRED') {
          toast(`${PLAT_META[platform]?.name} token expired — reconnect`)
          handleConnect(platform)
        } else if (data.code === 'NOT_CONNECTED') {
          toast(`${PLAT_META[platform]?.name} not connected`)
          handleConnect(platform)
        } else {
          toast(`Publish failed: ${data.error || 'Unknown error'}`)
        }
      } else {
        if (data.entry) {
          setPublishLog(prev => [data.entry, ...prev])
        }
        toast(`Published to ${PLAT_META[platform]?.name}!`)
      }
    } catch {
      toast('Publish failed — check connection')
    }
    setPublishing(p => ({ ...p, [platform]: false }))
  }

  // OpenClaw auto-post
  async function handleOpenClaw(platform: string) {
    const content = generatedContent[platform]
    if (!content) {
      toast('No content to publish — generate first')
      return
    }

    const name = PLAT_META[platform]?.name || platform
    toast(`\u{1F916} OpenClaw is posting to ${name}...`)
    setPublishing(p => ({ ...p, [platform]: true }))

    try {
      const res = await fetch('/api/publish/openclaw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, content, action: 'post' }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast(`OpenClaw failed: ${data.error || 'Unknown error'}`)
        setPublishLog(prev => [{
          id: crypto.randomUUID(),
          user_id: '',
          platform,
          content,
          status: 'failed' as const,
          platform_post_id: null,
          created_at: new Date().toISOString(),
        }, ...prev])
      } else {
        if (data.entry) {
          setPublishLog(prev => [data.entry, ...prev])
        }
        toast(`\u2713 Posted to ${name}!`)
      }
    } catch {
      toast('OpenClaw failed — check connection')
    }
    setPublishing(p => ({ ...p, [platform]: false }))
  }

  // Platforms with generated content
  const platformsWithContent = Object.keys(generatedContent).filter(
    k => generatedContent[k] && enabledPlatforms[k]
  )

  return (
    <>
      {/* Connection bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-shrink-0 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mr-1">
          Accounts
        </span>
        {/* OAuth platforms */}
        {(['linkedin', 'x', 'substack'] as const).map(pk => {
          const meta = PLAT_META[pk]
          const conn = connections[pk]
          const isConnected = conn?.connected && !conn?.expired
          return (
            <button
              key={pk}
              onClick={() => isConnected ? handleDisconnect(pk) : handleConnect(pk)}
              className={`flex items-center gap-[5px] px-3 py-[5px] rounded-full border text-xs font-medium cursor-pointer transition-all select-none ${
                isConnected
                  ? 'border-[#34d399] bg-[#ecfdf5] text-[#059669]'
                  : 'border-border text-text2 hover:border-accent hover:text-accent'
              }`}
            >
              {isConnected && <span className="w-[6px] h-[6px] rounded-full bg-[#34d399]" />}
              <span>{meta.icon}</span>
              {meta.name}
              {isConnected && <span className="text-[10px]">✓</span>}
            </button>
          )
        })}
        {/* Copy-only: Rednote */}
        <div className="flex items-center gap-[5px] px-3 py-[5px] rounded-full border border-border text-xs font-medium opacity-60 cursor-default select-none">
          <span>🌸</span>Rednote <span className="text-[10px] text-text3 ml-0.5">copy &amp; paste</span>
        </div>
        {/* Soon platforms */}
        {(['notejp', 'instagram'] as const).map(pk => {
          const meta = PLAT_META[pk]
          return (
            <div
              key={pk}
              className="flex items-center gap-[5px] px-3 py-[5px] rounded-full border border-border text-xs font-medium opacity-50 cursor-default select-none"
            >
              <span>{meta.icon}</span>{meta.name} <span className="text-[10px] opacity-70">soon</span>
            </div>
          )
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="font-serif text-lg">Published content</div>
          <button
            onClick={() => onNavigate('generate')}
            className="inline-flex items-center justify-center gap-1.5 font-sans text-xs font-medium px-3.5 py-[7px] rounded-lg border border-border2 bg-bg text-text2 transition-all hover:border-border2 hover:text-text hover:bg-bg2"
          >
            ← Back to Generate
          </button>
        </div>

        {/* Content cards to publish */}
        {platformsWithContent.length > 0 && (
          <div className="flex flex-col gap-2.5 mb-6">
            {platformsWithContent.map(pk => {
              const meta = PLAT_META[pk]
              if (!meta) return null
              const content = generatedContent[pk]
              const isLoading = publishing[pk]
              const isCopyOnly = COPY_ONLY.includes(pk)
              const conn = connections[pk]
              const isConnected = conn?.connected && !conn?.expired

              return (
                <div
                  key={pk}
                  className="border border-border rounded-[11px] p-4 transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-[15px]">{meta.icon}</span>
                    <span className="text-[13px] font-semibold text-text flex-1">{meta.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePublish(pk)}
                        disabled={isLoading}
                        className={`px-3.5 py-[6px] rounded-lg text-[12px] font-semibold text-white transition-all disabled:opacity-50 ${meta.color} hover:opacity-90`}
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" />
                            {isCopyOnly ? 'Copying…' : 'Publishing…'}
                          </span>
                        ) : isCopyOnly ? (
                          pk === 'rednote' ? '🌸 Copy & draft' : 'Copy & draft'
                        ) : isConnected ? (
                          'Publish'
                        ) : (
                          'Connect & Publish'
                        )}
                      </button>
                      {isCopyOnly && (
                        <button
                          onClick={() => handleOpenClaw(pk)}
                          disabled={!hasOpenClawKey || isLoading}
                          className="px-3.5 py-[6px] rounded-lg text-[12px] font-semibold transition-all border border-[#7c3aed]/20 hover:opacity-90 disabled:cursor-not-allowed"
                          style={{
                            background: hasOpenClawKey ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.04)',
                            color: hasOpenClawKey ? '#7c3aed' : '#a78bfa',
                            opacity: hasOpenClawKey ? 1 : 0.5,
                          }}
                          title={hasOpenClawKey ? 'Auto-post with OpenClaw browser automation' : 'Add OPENCLAW_API_KEY to .env.local to enable'}
                        >
                          🤖 Auto-post with OpenClaw
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[12.5px] text-text2 leading-relaxed line-clamp-3 overflow-hidden">
                    {content.slice(0, 200)}{content.length > 200 ? '…' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Publish log */}
        {publishLog.length > 0 ? (
          <div className="flex flex-col gap-[5px]">
            <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mb-1 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-border">
              History
            </div>
            {publishLog.map(entry => {
              const meta = PLAT_META[entry.platform]
              const isDraft = entry.status === 'draft'
              const isAutoPosted = entry.status === 'auto-posted'
              const isFailed = entry.status === 'failed'
              const date = new Date(entry.created_at)
              const dateStr = date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
              const timeStr = date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
              const preview = entry.content.slice(0, 50).replace(/\n/g, ' ')

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-[9px] border border-border transition-all hover:shadow-sm"
                >
                  <span className="text-[15px] flex-shrink-0">{meta?.icon || '📄'}</span>
                  <span className="text-[12.5px] font-semibold text-text w-[100px] flex-shrink-0 truncate">
                    {meta?.name || entry.platform}
                  </span>
                  <span className="text-[12px] text-text2 flex-1 truncate">{preview}</span>
                  <span
                    className={`text-[10.5px] font-semibold px-2 py-[2px] rounded-full flex-shrink-0 ${
                      isFailed
                        ? 'bg-[#fee2e2] text-[#991b1b]'
                        : isAutoPosted
                        ? 'bg-[#ede9fe] text-[#6d28d9]'
                        : isDraft
                        ? 'bg-[#fef3c7] text-[#92400e]'
                        : 'bg-[#d1fae5] text-[#065f46]'
                    }`}
                  >
                    {isFailed ? 'failed' : isAutoPosted ? '🤖 auto-posted' : isDraft ? 'copied as draft' : 'published'}
                  </span>
                  <span className="text-[11px] text-text3 w-[90px] text-right flex-shrink-0">
                    {dateStr} {timeStr}
                  </span>
                  <span className="text-[11.5px] flex-shrink-0 w-[100px] text-right">
                    {isDraft ? (
                      <span className="text-text3">Paste into app</span>
                    ) : entry.platform_post_id ? (
                      <a
                        href={getPostUrl(entry.platform, entry.platform_post_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline font-medium"
                      >
                        View post ↗
                      </a>
                    ) : (
                      <span className="text-[#065f46] font-medium">Published</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        ) : platformsWithContent.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-[60px] text-center gap-2">
            <div className="text-[32px] opacity-20 mb-1">📬</div>
            <div className="font-serif text-lg text-text2">Nothing published yet</div>
            <div className="text-[13px] text-text3 leading-relaxed max-w-[280px]">
              Generate content then send to each platform. It&apos;ll show up here to track and manage.
            </div>
          </div>
        ) : null}
      </div>

      {/* OAuth modal */}
      {oauthTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOauthTarget(null)}
        >
          <div
            className="bg-bg rounded-2xl p-[26px] w-[360px] shadow-2xl border border-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="text-[30px] mb-2">{PLAT_META[oauthTarget]?.icon}</div>
              <div className="font-serif text-lg">Connect {PLAT_META[oauthTarget]?.name}</div>
              <div className="text-[13px] text-text3 mt-1">
                Authorize Human to publish on your behalf
              </div>
            </div>
            <button
              onClick={() => doOAuth(oauthTarget)}
              className={`w-full py-2.5 rounded-lg text-white text-[13.5px] font-semibold transition-all hover:opacity-90 ${PLAT_META[oauthTarget]?.color}`}
            >
              Connect {PLAT_META[oauthTarget]?.name}
            </button>
            <button
              onClick={() => setOauthTarget(null)}
              className="w-full py-2 mt-2 text-[13px] text-text3 hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function getPostUrl(platform: string, postId: string): string {
  if (platform === 'linkedin') return `https://www.linkedin.com/feed/update/${postId}`
  if (platform === 'x') return `https://twitter.com/i/status/${postId}`
  return '#'
}
