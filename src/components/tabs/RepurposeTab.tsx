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

function isSubstackUrl(str: string): boolean {
  return /^https?:\/\/[^/]*\.substack\.com\//i.test(str.trim()) ||
         /^https?:\/\/[^/]*\/p\//i.test(str.trim()) && /substack/i.test(str)
}

type Props = {
  brandVoice: string
  tone: string
  enabledPlatforms: Record<string, boolean>
  onGeneratedContentChange: (content: Record<string, string>) => void
  onNavigateToPublish: () => void
}

export default function RepurposeTab({
  brandVoice,
  tone,
  enabledPlatforms,
  onGeneratedContentChange,
  onNavigateToPublish,
}: Props) {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<Record<string, string>>({})
  const [fetching, setFetching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showCarousel, setShowCarousel] = useState(false)
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const tweetRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const selectedPlatforms = Object.keys(enabledPlatforms).filter(k => enabledPlatforms[k])
  const hasResults = Object.keys(results).length > 0

  async function handleRepurpose() {
    const trimmed = input.trim()
    if (!trimmed) {
      toast('Paste a URL or some text first')
      return
    }
    if (selectedPlatforms.length === 0) {
      toast('Enable platforms in Configure tab')
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
          body: JSON.stringify({
            type: 'url',
            extra: { url: trimmed, hint: isSubstackUrl(trimmed) ? 'substack-newsletter' : undefined },
          }),
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
          brandVoice,
          tone,
        }),
      })

      const data = await res.json()
      if (data.error) {
        toast('Generation failed: ' + data.error)
        setGenerating(false)
        return
      }

      setResults(data.results || {})
      onGeneratedContentChange(data.results || {})
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
    const updated = { ...results, [pk]: content }
    setResults(updated)
    onGeneratedContentChange(updated)
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
          {isSubstackUrl(input) && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-[#fff7ed] border border-[#ff6719]/20">
              <span className="text-[13px]">📧</span>
              <span className="text-[12px] font-medium text-[#c2410c]">Newsletter detected</span>
              <span className="text-[11px] text-[#c2410c]/70">— optimized extraction for Substack articles</span>
            </div>
          )}
        </div>

        {/* Platform summary */}
        <div className="mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mb-2.5">
            Posting to
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedPlatforms.map(pk => {
              const meta = PLATS[pk]
              if (!meta) return null
              return (
                <span
                  key={pk}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-acb bg-acl text-[12px] font-medium text-accent"
                >
                  <span className="text-[13px]">{meta.icon}</span>
                  {meta.name}
                </span>
              )
            })}
            {selectedPlatforms.length === 0 && (
              <span className="text-[12px] text-text3">No platforms enabled — configure in the Configure tab</span>
            )}
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
            <>✦ {isSubstackUrl(input.trim()) ? 'Repurpose newsletter' : isUrl(input.trim()) ? 'Fetch & Repurpose' : 'Repurpose'}</>
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

        {hasResults && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onNavigateToPublish}
              className="px-5 py-2.5 rounded-[9px] bg-text text-bg font-semibold text-[13.5px] transition-all hover:bg-[#2a2926] hover:-translate-y-px hover:shadow-md"
            >
              Publish content →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
