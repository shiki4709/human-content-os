'use client'

import { useState, useRef, useEffect } from 'react'
import type { SourceType } from '@/types'
import { BADGE_STYLES } from '@/types'

interface ResolvedSource {
  type: SourceType
  label: string
  content: string
}

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (source: { type: SourceType; label: string; content: string }) => void
}

const SOURCE_TYPES: { key: SourceType; icon: string; name: string; desc: string }[] = [
  { key: 'url', icon: '🔗', name: 'Social / Link', desc: 'Any URL or social post' },
  { key: 'search', icon: '🔍', name: 'Web search', desc: 'Topic + time range' },
  { key: 'youtube', icon: '▶️', name: 'YouTube channel', desc: 'Channel + # videos' },
  { key: 'twitter', icon: '𝕏', name: 'X account', desc: '@handle + period' },
  { key: 'notes', icon: '📝', name: 'My notes', desc: 'Paste your own text' },
]

const PERIOD_OPTIONS = [
  { val: '24h', label: 'Past 24h' },
  { val: '7d', label: 'Past 7 days' },
  { val: '30d', label: 'Past 30 days' },
  { val: '3m', label: 'Past 3 months' },
]

const COUNT_OPTIONS = [
  { val: '1', label: 'Latest 1' },
  { val: '3', label: 'Latest 3' },
  { val: '5', label: 'Latest 5' },
  { val: '10', label: 'Latest 10' },
]

export default function AddSourceModal({ open, onClose, onAdd }: Props) {
  const [activeType, setActiveType] = useState<SourceType>('url')
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState('')
  const [resolved, setResolved] = useState<ResolvedSource | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [footerMsg, setFooterMsg] = useState('')

  // Field values
  const [urlVal, setUrlVal] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchPeriod, setSearchPeriod] = useState('7d')
  const [ytChannel, setYtChannel] = useState('')
  const [ytCount, setYtCount] = useState('3')
  const [twHandle, setTwHandle] = useState('')
  const [twPeriod, setTwPeriod] = useState('7d')
  const [notesVal, setNotesVal] = useState('')

  // Result edit state
  const [editLabel, setEditLabel] = useState('')
  const [editContent, setEditContent] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Focus first input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => urlInputRef.current?.focus(), 120)
    }
  }, [open])

  function resetModal() {
    setActiveType('url')
    setFetching(false)
    setResolved(null)
    setShowResult(false)
    setFooterMsg('')
    setUrlVal('')
    setSearchQuery('')
    setSearchPeriod('7d')
    setYtChannel('')
    setYtCount('3')
    setTwHandle('')
    setTwPeriod('7d')
    setNotesVal('')
    setEditLabel('')
    setEditContent('')
  }

  function handleClose() {
    resetModal()
    onClose()
  }

  function switchType(t: SourceType) {
    setActiveType(t)
    setResolved(null)
    setShowResult(false)
    setFooterMsg('')
    setFetching(false)
  }

  function getExtra(): Record<string, string> {
    switch (activeType) {
      case 'url': return { url: urlVal.trim() }
      case 'search': return { query: searchQuery.trim(), period: searchPeriod }
      case 'youtube': return { channel: ytChannel.trim(), count: ytCount }
      case 'twitter': return { handle: twHandle.trim(), period: twPeriod }
      case 'notes': return { content: notesVal.trim() }
    }
  }

  function getInputVal(): string {
    switch (activeType) {
      case 'url': return urlVal.trim()
      case 'search': return searchQuery.trim()
      case 'youtube': return ytChannel.trim()
      case 'twitter': return twHandle.trim()
      case 'notes': return notesVal.trim()
    }
  }

  async function handleFetch() {
    if (!getInputVal()) return
    setFetching(true)
    setShowResult(false)
    setResolved(null)

    const loadingMsgs: Record<string, string> = {
      url: 'Fetching page…',
      search: 'Searching the web…',
      youtube: 'Pulling channel videos…',
      twitter: `Fetching ${twHandle.trim()} tweets…`,
      notes: 'Processing…',
    }
    setFetchMsg(loadingMsgs[activeType] || 'Processing…')

    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeType, extra: getExtra() }),
      })
      const data = await res.json()
      const src: ResolvedSource = {
        type: activeType,
        label: data.label,
        content: data.content,
      }
      setResolved(src)
      setEditLabel(src.label)
      setEditContent(src.content)
      setShowResult(true)
      setFooterMsg('✓ Review and edit, then add')
    } catch {
      const src: ResolvedSource = {
        type: activeType,
        label: 'Source',
        content: '(Fetch failed — added as stub)',
      }
      setResolved(src)
      setEditLabel(src.label)
      setEditContent(src.content)
      setShowResult(true)
      setFooterMsg('⚠️ Fetch failed — added as stub')
    }
    setFetching(false)
  }

  function handleAdd() {
    if (activeType === 'notes') {
      if (!notesVal.trim()) return
      const label = 'My notes · ' + new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })
      onAdd({ type: 'notes', label, content: notesVal.trim() })
      handleClose()
      return
    }

    if (!resolved) return
    const finalLabel = editLabel.trim() || resolved.label
    const finalContent = contentRef.current?.textContent?.trim() || editContent || resolved.content
    onAdd({ type: resolved.type, label: finalLabel, content: finalContent })
    handleClose()
  }

  if (!open) return null

  const badge = BADGE_STYLES[activeType] || BADGE_STYLES.notes
  const showFetchBtn = activeType !== 'notes'
  const showAddBtn = activeType === 'notes' || showResult

  return (
    <div
      className="fixed inset-0 bg-black/[.28] backdrop-blur-[6px] flex items-center justify-center z-[400] overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-bg rounded-2xl border border-border w-[520px] max-w-[94vw] shadow-[0_24px_60px_rgba(0,0,0,.14)] px-[22px] pt-5 pb-0">
        {/* Title */}
        <div className="font-serif text-[19px] mb-[3px]">Add a source</div>
        <div className="text-[12.5px] text-text2 leading-relaxed mb-3.5">
          Pick the type — each has its own fields.
        </div>

        {/* Source type grid */}
        <div className="grid grid-cols-3 gap-[5px] mb-0">
          {SOURCE_TYPES.map(st => (
            <button
              key={st.key}
              onClick={() => switchType(st.key)}
              className={`flex flex-col items-center gap-[3px] py-2 px-1.5 rounded-[10px] border-[1.5px] cursor-pointer transition-all select-none ${
                activeType === st.key
                  ? 'border-accent bg-acl'
                  : 'border-border bg-bg2 hover:border-border2 hover:bg-bg'
              }`}
            >
              <span className="text-lg leading-none">{st.icon}</span>
              <span className={`text-[11.5px] font-semibold text-center leading-tight ${
                activeType === st.key ? 'text-accent' : 'text-text2'
              }`}>{st.name}</span>
              <span className="text-[10px] text-text3 text-center leading-tight">{st.desc}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-border my-3.5" />

        {/* Field groups */}
        {activeType === 'url' && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-text3 mb-[5px]">URL</div>
            <input
              ref={urlInputRef}
              type="text"
              value={urlVal}
              onChange={e => setUrlVal(e.target.value)}
              placeholder="https://  — article, tweet, Instagram post, LinkedIn post…"
              className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-3 py-[9px] outline-none leading-relaxed transition-colors focus:border-accent placeholder:text-text3"
              onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
            />
            <div className="text-[11.5px] text-text3 leading-relaxed py-2 px-2.5 bg-bg3 rounded-[7px]">
              Works with any public URL — articles, tweets, Instagram posts, LinkedIn posts, YouTube videos, Rednote links.
            </div>
          </div>
        )}

        {activeType === 'search' && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-text3 mb-[5px]">Search query</div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder='e.g. "AI agents" or "OpenAI news"'
              className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-3 py-[9px] outline-none leading-relaxed transition-colors focus:border-accent placeholder:text-text3"
              onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
            />
            <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-text3 mt-1 mb-[5px]">Time range</div>
            <div className="grid grid-cols-4 gap-[5px]">
              {PERIOD_OPTIONS.map(o => (
                <button
                  key={o.val}
                  onClick={() => setSearchPeriod(o.val)}
                  className={`py-[7px] px-1 rounded-[7px] border font-sans text-xs font-medium text-center cursor-pointer transition-all ${
                    searchPeriod === o.val
                      ? 'border-accent bg-acl text-accent'
                      : 'border-border bg-bg2 text-text2 hover:border-border2'
                  }`}
                >{o.label}</button>
              ))}
            </div>
          </div>
        )}

        {activeType === 'youtube' && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-text3 mb-[5px]">Channel name or URL</div>
            <input
              type="text"
              value={ytChannel}
              onChange={e => setYtChannel(e.target.value)}
              placeholder='e.g. "Lex Fridman" or youtube.com/@lexfridman'
              className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-3 py-[9px] outline-none leading-relaxed transition-colors focus:border-accent placeholder:text-text3"
              onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
            />
            <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-text3 mt-1 mb-[5px]">Recent videos to pull</div>
            <div className="grid grid-cols-4 gap-[5px]">
              {COUNT_OPTIONS.map(o => (
                <button
                  key={o.val}
                  onClick={() => setYtCount(o.val)}
                  className={`py-[7px] px-1 rounded-[7px] border font-sans text-xs font-medium text-center cursor-pointer transition-all ${
                    ytCount === o.val
                      ? 'border-accent bg-acl text-accent'
                      : 'border-border bg-bg2 text-text2 hover:border-border2'
                  }`}
                >{o.label}</button>
              ))}
            </div>
            <div className="text-[11.5px] text-text3 leading-relaxed py-2 px-2.5 bg-bg3 rounded-[7px]">
              Pulls transcripts and key insights from the most recent videos.
            </div>
          </div>
        )}

        {activeType === 'twitter' && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-text3 mb-[5px]">X / Twitter handle</div>
            <input
              type="text"
              value={twHandle}
              onChange={e => setTwHandle(e.target.value)}
              placeholder="@handle — e.g. @sama or @elonmusk"
              className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-3 py-[9px] outline-none leading-relaxed transition-colors focus:border-accent placeholder:text-text3"
              onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
            />
            <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-text3 mt-1 mb-[5px]">Time period</div>
            <div className="grid grid-cols-4 gap-[5px]">
              {PERIOD_OPTIONS.map(o => (
                <button
                  key={o.val}
                  onClick={() => setTwPeriod(o.val)}
                  className={`py-[7px] px-1 rounded-[7px] border font-sans text-xs font-medium text-center cursor-pointer transition-all ${
                    twPeriod === o.val
                      ? 'border-accent bg-acl text-accent'
                      : 'border-border bg-bg2 text-text2 hover:border-border2'
                  }`}
                >{o.label}</button>
              ))}
            </div>
            <div className="text-[11.5px] text-text3 leading-relaxed py-2 px-2.5 bg-bg3 rounded-[7px]">
              Fetches their recent posts and threads within the period.
            </div>
          </div>
        )}

        {activeType === 'notes' && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-text3 mb-[5px]">Your notes</div>
            <textarea
              value={notesVal}
              onChange={e => setNotesVal(e.target.value)}
              rows={5}
              placeholder="Paste raw notes, meeting notes, ideas, draft content…"
              className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-3 py-[9px] outline-none resize-none leading-relaxed transition-colors focus:border-accent placeholder:text-text3"
            />
          </div>
        )}

        {/* Fetching state */}
        {fetching && (
          <div className="flex items-center gap-2 p-3 my-1.5 bg-bg2 rounded-[9px] border border-border">
            <div className="w-[11px] h-[11px] border-[1.5px] border-border2 border-t-accent rounded-full animate-spin-fast flex-shrink-0" />
            <span className="text-[12.5px] text-text2">{fetchMsg}</span>
          </div>
        )}

        {/* Result preview */}
        {showResult && resolved && (
          <div className="flex flex-col gap-2 pt-1.5 pb-1">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold py-[3px] px-[9px] rounded-full flex-shrink-0 ${badge.bg} ${badge.text}`}>
                {badge.icon} {badge.label}
              </span>
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                placeholder="Label this source…"
                className="flex-1 font-sans text-[13px] font-semibold text-text border-none outline-none bg-transparent py-[3px] px-[7px] rounded-md border border-transparent transition-colors focus:border-border2 focus:bg-bg2"
              />
            </div>
            <div className="bg-bg2 border border-border rounded-[9px] overflow-hidden">
              <div className="max-h-[150px] overflow-y-auto py-[11px] px-[13px]">
                <div
                  ref={contentRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="text-[13px] leading-[1.62] text-text whitespace-pre-wrap outline-none"
                  onInput={() => {
                    setEditContent(contentRef.current?.textContent || '')
                  }}
                >
                  {resolved.content}
                </div>
              </div>
              <div className="py-1.5 px-[11px] border-t border-border flex justify-between">
                <span className="text-[11px] text-text3">
                  {(contentRef.current?.textContent || editContent || '').length} chars
                </span>
                <span className="text-[11px] text-accent">✏️ Click to edit</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between py-3.5 border-t border-border mt-4">
          <span className="text-xs text-text3">{footerMsg}</span>
          <div className="flex gap-[7px]">
            <button
              onClick={handleClose}
              className="px-[13px] py-[7px] rounded-lg border border-border bg-bg font-sans text-[13px] text-text2 cursor-pointer transition-all hover:bg-bg3"
            >
              Cancel
            </button>
            {showFetchBtn && (
              <button
                onClick={handleFetch}
                disabled={fetching || !getInputVal()}
                className="px-4 py-[7px] rounded-lg border-none bg-accent text-white font-sans text-[13px] font-semibold cursor-pointer transition-all hover:bg-[#1447c0] disabled:opacity-35 disabled:cursor-not-allowed"
              >
                Fetch content →
              </button>
            )}
            {showAddBtn && (
              <button
                onClick={handleAdd}
                className="px-4 py-[7px] rounded-lg border-none bg-text text-bg font-sans text-[13px] font-semibold cursor-pointer transition-all hover:bg-[#2a2926]"
              >
                ＋ Add to sources
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
