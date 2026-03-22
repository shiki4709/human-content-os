'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Settings {
  rss_url?: string | null
  base_voice?: string | null
}

interface Connection {
  connected: boolean
  expired: boolean
  name?: string
}

interface ConnectionsData {
  connections: Record<string, Connection>
  configured: Record<string, boolean>
}

export default function SettingsPage() {
  const [rssUrl, setRssUrl] = useState('')
  const [baseVoice, setBaseVoice] = useState('')
  const [connections, setConnections] = useState<Record<string, Connection>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, connectionsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/connections'),
        ])

        if (settingsRes.ok) {
          const data = await settingsRes.json()
          const s: Settings = data.settings ?? {}
          setRssUrl(s.rss_url ?? '')
          setBaseVoice(s.base_voice ?? '')
        }

        if (connectionsRes.ok) {
          const data: ConnectionsData = await connectionsRes.json()
          setConnections(data.connections ?? {})
          setConfigured(data.configured ?? {})
        }
      } catch {
        // silently continue with defaults
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rss_url: rssUrl, base_voice: baseVoice }),
      })
      if (res.ok) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect(platform: string) {
    setDisconnecting(platform)
    try {
      await fetch('/api/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      setConnections((prev) => {
        const next = { ...prev }
        delete next[platform]
        return next
      })
    } catch {
      // silently ignore
    } finally {
      setDisconnecting(null)
    }
  }

  const platforms = [
    {
      key: 'linkedin',
      label: 'LinkedIn',
      color: '#0a66c2',
      connectUrl: '/api/auth/linkedin',
    },
    {
      key: 'x',
      label: 'X (Twitter)',
      color: '#000000',
      connectUrl: '/api/auth/x',
    },
  ]

  if (loading) {
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

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        color: 'var(--text)',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* Back link */}
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            color: 'var(--text3)',
            fontSize: '0.8125rem',
            textDecoration: 'none',
            marginBottom: '2rem',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text3)')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to dashboard
        </Link>

        {/* Page title */}
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: '2rem',
            letterSpacing: '-0.01em',
          }}
        >
          Settings
        </h1>

        {/* Settings form card */}
        <div
          style={{
            backgroundColor: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <h2
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '1.25rem',
            }}
          >
            Content source
          </h2>

          {/* Substack RSS URL */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="rss-url"
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--text2)',
                marginBottom: '0.5rem',
              }}
            >
              Substack RSS URL
            </label>
            <input
              id="rss-url"
              type="text"
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder="https://yourname.substack.com/feed"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                fontSize: '0.875rem',
                color: 'var(--text)',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Base Voice */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="base-voice"
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--text2)',
                marginBottom: '0.375rem',
              }}
            >
              Base voice
            </label>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text3)',
                marginBottom: '0.5rem',
                lineHeight: 1.5,
              }}
            >
              Platform-specific tones are applied automatically. This is additional context about your general style.
            </p>
            <textarea
              id="base-voice"
              value={baseVoice}
              onChange={(e) => setBaseVoice(e.target.value)}
              placeholder="e.g. Direct and opinionated. I write like I'm thinking out loud — no fluff, no corporate speak."
              rows={4}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                fontSize: '0.875rem',
                color: 'var(--text)',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.5,
                transition: 'border-color 0.15s',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '0.5625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--bg)',
                backgroundColor: saving ? 'var(--text3)' : 'var(--accent)',
                border: 'none',
                borderRadius: '8px',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s, opacity 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            {saveStatus === 'saved' && (
              <span style={{ fontSize: '0.8125rem', color: '#22c55e' }}>
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span style={{ fontSize: '0.8125rem', color: '#ef4444' }}>
                Failed to save
              </span>
            )}
          </div>
        </div>

        {/* Connected platforms card */}
        <div
          style={{
            backgroundColor: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.5rem',
          }}
        >
          <h2
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '1.25rem',
            }}
          >
            Connected platforms
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {platforms.map((platform) => {
              const conn = connections[platform.key]
              const isConnected = conn?.connected && !conn?.expired
              const isExpired = conn?.connected && conn?.expired
              const isConfiguredPlatform = configured[platform.key]

              return (
                <div
                  key={platform.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 1rem',
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Platform dot */}
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isConnected
                          ? '#22c55e'
                          : isExpired
                          ? '#f59e0b'
                          : 'var(--border)',
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: 'var(--text)',
                        }}
                      >
                        {platform.label}
                        {conn?.name && (
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.75rem',
                              color: 'var(--text3)',
                              fontWeight: 400,
                            }}
                          >
                            {conn.name}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: isConnected
                            ? '#16a34a'
                            : isExpired
                            ? '#d97706'
                            : 'var(--text3)',
                          marginTop: '1px',
                        }}
                      >
                        {isConnected
                          ? 'Connected'
                          : isExpired
                          ? 'Token expired — reconnect'
                          : 'Not connected'}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(platform.key)}
                        disabled={disconnecting === platform.key}
                        style={{
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text2)',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          cursor: disconnecting === platform.key ? 'not-allowed' : 'pointer',
                          opacity: disconnecting === platform.key ? 0.5 : 1,
                          transition: 'border-color 0.15s, color 0.15s',
                          fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#ef4444'
                          e.currentTarget.style.color = '#ef4444'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)'
                          e.currentTarget.style.color = 'var(--text2)'
                        }}
                      >
                        {disconnecting === platform.key ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    ) : (
                      <a
                        href={isConfiguredPlatform ? platform.connectUrl : undefined}
                        style={{
                          display: 'inline-block',
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: isConfiguredPlatform ? 'var(--bg)' : 'var(--text3)',
                          backgroundColor: isConfiguredPlatform ? platform.color : 'var(--border)',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          cursor: isConfiguredPlatform ? 'pointer' : 'default',
                          transition: 'opacity 0.15s',
                          pointerEvents: isConfiguredPlatform ? 'auto' : 'none',
                        }}
                        onMouseEnter={(e) => isConfiguredPlatform && (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={(e) => isConfiguredPlatform && (e.currentTarget.style.opacity = '1')}
                      >
                        {isExpired ? 'Reconnect' : 'Connect'}
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {Object.values(configured).every((v) => !v) && (
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text3)',
                marginTop: '1rem',
                lineHeight: 1.5,
              }}
            >
              Platform OAuth is not yet configured. Add the required environment variables to enable connections.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
