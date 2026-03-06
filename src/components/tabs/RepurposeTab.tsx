'use client'

import { useState, useRef } from 'react'
import { toast } from '@/components/Toast'
import RednoteCarousel from '@/components/generate/RednoteCarousel'

const PLATS: Record<string, { name: string; icon: string; color: string }> = {
  linkedin: { name: 'LinkedIn', icon: '💼', color: 'bg-[#0a66c2]' },
  x: { name: 'X / Twitter', icon: '𝕏', color: 'bg-[#000]' },
  substack: { name: 'Substack', icon: '📧', color: 'bg-[#ff6719]' },
  rednote: { name: 'Rednote 小红书', icon: '🌸', color: 'bg-[#ff2442]' },
}

const COPY_ONLY = ['rednote']

function parseXThread(content: string): string[] {
  const parts = content.split(/TWEET_\d+:\s*/i).filter(t => t.trim())
  if (parts.length > 1) return parts.map(t => t.split('|')[0].trim()).filter(Boolean)
  const byPipe = content.split('|').map(t => t.trim()).filter(t => t.length > 10)
  if (byPipe.length > 1) return byPipe
  const byDash = content.split(/\n---\n/).map(t => t.trim()).filter(Boolean)
  if (byDash.length > 1) return byDash
  const byNum = content.split(/\n\d+[/.]\s*/).filter(t => t.trim())
  if (byNum.length > 1) return byNum
  const words = content.split(' ')
  const tweets: string[] = []
  let cur = ''
  words.forEach(w => {
    if ((cur + ' ' + w).length > 260) { tweets.push(cur.trim()); cur = w }
    else cur = cur ? cur + ' ' + w : w
  })
  if (cur) tweets.push(cur.trim())
  return tweets.filter(Boolean)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function isUrl(str: string): boolean {
  return /^https?:\/\//i.test(str.trim())
}

export default function RepurposeTab() {
  const [input, setInput] = useState('')
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({
    linkedin: true,
    x: true,
    substack: false,
    rednote: false,
  })
  const [results, setResults] = useState<Record<string, string>>({})
  const [fetching, setFetching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showCarousel, setShowCarousel] = useState(false)
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const tweetRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const selectedPlatforms = Object.keys(platforms).filter(k => platforms[k])
  const hasResults = Object.keys(results).length > 0

  async function handleRepurpose() {
    const trimmed = input.trim()
    if (!trimmed) {
      toast('Paste a URL or some text first')
      return
    }
    if (selectedPlatforms.length === 0) {
      toast('Select at least one platform')
      return
    }

    let sourceContent = trimmed

    // If URL, fetch content first
    if (isUrl(trimmed)) {
      setFetching(true)
      try {
        const res = await fetch('/api/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'url', extra: { url: trimmed } }),
        })
        const data = await res.json()
        if (data.error) {
          toast('Failed to fetch URL: ' + data.error)
          setFetching(false)
          return
        }
        sourceContent = data.content
      } catch {
        toast('Failed to fetch URL')
        setFetching(false)
        return
      }
      setFetching(false)
    }

    // Generate for selected platforms
    setGenerating(true)
    setResults({})
    setShowCarousel(false)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: [{ label: isUrl(trimmed) ? trimmed : 'Pasted content', content: sourceContent }],
          platforms: selectedPlatforms,
          brandVoice: '',
          tone: 'Thought leader',
        }),
      })

      const data = await res.json()
      if (data.error) {
        toast('Generation failed: ' + data.error)
        setGenerating(false)
        return
      }

      setResults(data.results || {})
      toast('Content repurposed')
    } catch {
      toast('Generation failed — check connection')
    } finally {
      setGenerating(false)
    }
  }

  function getEditedContent(pk: string): string {
    if (pk === 'x') {
      const container = tweetRefs.current[pk]
      if (!container) return results[pk] || ''
      const tweetEls = container.querySelectorAll<HTMLDivElement>('[data-tweet]')
      const tweets: string[] = []
      tweetEls.forEach(el => tweets.push(el.textContent?.trim() || ''))
      return tweets.filter(Boolean).join('\n\n')
    }
    const el = editorRefs.current[pk]
    return el?.innerText || results[pk] || ''
  }

  function handleContentEdit(pk: string) {
    const content = getEditedContent(pk)
    setResults(prev => ({ ...prev, [pk]: content }))
  }

  async function handlePublish(pk: string) {
    const content = results[pk]
    if (!content) return

    if (COPY_ONLY.includes(pk)) {
      try { await navigator.clipboard.writeText(content) } catch { toast('Could not copy'); return }
      try {
        await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: pk, content }),
        })
      } catch {}
      toast(`Copied — open ${PLATS[pk]?.name} and paste`)
      return
    }

    // OAuth platforms — publish via API
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: pk, content }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'NOT_CONNECTED') {
          toast(`Connect ${PLATS[pk]?.name} first (Publish tab)`)
        } else {
          toast(`Publish failed: ${data.error || 'Unknown error'}`)
        }
      } else {
        toast(data.status === 'draft' ? `Copied as draft` : `Published to ${PLATS[pk]?.name}!`)
      }
    } catch {
      toast('Publish failed')
    }
  }

  async function handleCopy(pk: string) {
    const content = getEditedContent(pk)
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      toast('Copied to clipboard')
    } catch {
      toast('Could not copy')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-6 py-8">
        {/* Input area */}
        <div className="mb-6">
          <div className="font-serif text-xl mb-1">Repurpose</div>
          <p className="text-[13px] text-text3 mb-4">
            Paste a URL or text, pick platforms, get ready-to-post content.
          </p>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={4}
            placeholder="Paste a URL (https://...) or text content to repurpose..."
            className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-4 py-3 outline-none resize-none leading-relaxed transition-colors focus:border-accent placeholder:text-text3"
          />
        </div>

        {/* Platform checkboxes */}
        <div className="mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mb-2.5">
            Target platforms
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PLATS).map(([key, meta]) => (
              <label
                key={key}
                onClick={() => setPlatforms(p => ({ ...p, [key]: !p[key] }))}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border cursor-pointer transition-all select-none ${
                  platforms[key]
                    ? 'border-acb bg-acl'
                    : 'border-border hover:border-border2'
                }`}
              >
                <span className="text-[14px]">{meta.icon}</span>
                <span className={`text-[13px] font-medium ${platforms[key] ? 'text-accent' : 'text-text2'}`}>
                  {meta.name}
                </span>
                <span
                  className={`w-[15px] h-[15px] rounded flex items-center justify-center text-[8px] flex-shrink-0 transition-all ${
                    platforms[key]
                      ? 'bg-accent border-accent text-white border-[1.5px]'
                      : 'border-[1.5px] border-border2 text-transparent'
                  }`}
                >
                  ✓
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Repurpose button */}
        <button
          onClick={handleRepurpose}
          disabled={fetching || generating || !input.trim()}
          className="px-5 py-2.5 rounded-[9px] bg-text text-bg font-semibold text-[13.5px] transition-all hover:bg-[#2a2926] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mb-8"
        >
          {fetching ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-bg border-t-transparent rounded-full animate-spin" />
              Fetching URL…
            </>
          ) : generating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-bg border-t-transparent rounded-full animate-spin" />
              Repurposing…
            </>
          ) : (
            <>✦ {isUrl(input.trim()) ? 'Fetch & Repurpose' : 'Repurpose'}</>
          )}
        </button>

        {/* Results */}
        {generating && !hasResults && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-[2.5px] border-border2 border-t-accent rounded-full animate-spin" />
            <div className="font-serif text-lg text-text2">Repurposing content…</div>
            <div className="text-[13px] text-text3">Creating platform-native posts. 10-20 seconds.</div>
          </div>
        )}

        {hasResults && (
          <div className="flex flex-col gap-4">
            <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-border">
              Results
            </div>

            {selectedPlatforms.map(pk => {
              const content = results[pk]
              if (!content) return null
              const meta = PLATS[pk]
              if (!meta) return null
              const isCopyOnly = COPY_ONLY.includes(pk)

              return (
                <div key={pk} className="border border-border rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-bg2">
                    <span className="text-[15px]">{meta.icon}</span>
                    <span className="text-[13px] font-semibold text-text flex-1">{meta.name}</span>
                    {pk === 'rednote' && (
                      <button
                        onClick={() => setShowCarousel(!showCarousel)}
                        className="text-xs px-2.5 py-1 rounded-full border border-border2 text-text2 hover:border-accent hover:text-accent transition-all"
                      >
                        {showCarousel ? '← Text' : '🖼 Image'}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(pk)}
                      className="text-xs px-2.5 py-1 rounded-full border border-border2 text-text2 hover:border-accent hover:text-accent transition-all"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => handlePublish(pk)}
                      className={`px-3 py-[5px] rounded-lg text-[12px] font-semibold text-white transition-all hover:opacity-90 ${meta.color}`}
                    >
                      {isCopyOnly ? '🌸 Copy & draft' : 'Publish'}
                    </button>
                  </div>

                  {/* Editor */}
                  {pk === 'rednote' && showCarousel ? (
                    <RednoteCarousel content={content} />
                  ) : pk === 'x' ? (
                    <div
                      className="p-4"
                      ref={el => { tweetRefs.current[pk] = el }}
                    >
                      {parseXThread(content).map((tweet, i) => (
                        <div key={i} className="mb-2.5 rounded-lg border border-border bg-bg overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg2">
                            <span className="text-[12px] font-medium text-text2">{i + 1}/</span>
                            <span className={`text-[11px] ${tweet.length > 280 ? 'text-red font-medium' : 'text-text3'}`}>
                              {tweet.length}/280
                            </span>
                          </div>
                          <div
                            data-tweet
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={() => handleContentEdit(pk)}
                            className="px-3 py-2.5 text-[13.5px] leading-relaxed text-text outline-none min-h-[50px]"
                            dangerouslySetInnerHTML={{ __html: escapeHtml(tweet) }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4">
                      <div
                        ref={el => { editorRefs.current[pk] = el }}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={() => handleContentEdit(pk)}
                        className="text-[14px] leading-relaxed text-text outline-none min-h-[120px] whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: escapeHtml(content) }}
                      />
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center px-4 py-1.5 border-t border-border">
                    <span className="text-[11px] text-text3">{content.length} chars</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
