'use client'

import { useState } from 'react'
import type { GeneratedContent } from '@/types'

interface PlatformCardProps {
  content: GeneratedContent
  onPublish: (id: string) => Promise<void>
  onRefine: (id: string, instruction: string) => Promise<void>
}

const PLATFORM_META: Record<string, { label: string; color: string; bgClass: string; borderClass: string; textClass: string; icon: React.ReactNode }> = {
  linkedin: {
    label: 'LinkedIn',
    color: '#0a66c2',
    bgClass: 'bg-linkedin',
    borderClass: 'border-linkedin/20',
    textClass: 'text-linkedin',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  x: {
    label: 'X',
    color: '#000000',
    bgClass: 'bg-xblack',
    borderClass: 'border-xblack/10',
    textClass: 'text-xblack',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
}

// Individual tweet card in a thread
function TweetCard({ text, index, total }: { text: string; index: number; total: number }) {
  return (
    <div className="relative pl-9 pb-3">
      {/* Avatar */}
      <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-bg3 border border-border flex items-center justify-center text-[10px] font-bold text-text3">
        {index + 1}
      </div>

      {/* Thread line */}
      {index < total - 1 && (
        <div className="absolute left-3.5 top-8 bottom-0 w-px bg-border" />
      )}

      {/* Tweet bubble */}
      <div className="bg-bg rounded-xl border border-border px-3.5 py-3">
        <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{text}</p>
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border">
          <span className="text-[10px] text-text3 font-medium">Tweet {index + 1}</span>
          <span className={[
            'text-[10px] font-semibold',
            text.length > 260 ? 'text-red' : text.length > 220 ? 'text-gold' : 'text-text3',
          ].join(' ')}>
            {text.length}/280
          </span>
        </div>
      </div>
    </div>
  )
}

export default function PlatformCard({ content, onPublish, onRefine }: PlatformCardProps) {
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState(content.content)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [refining, setRefining] = useState(false)
  const [copied, setCopied] = useState(false)

  const meta = PLATFORM_META[content.platform] ?? {
    label: content.platform,
    color: '#666',
    bgClass: 'bg-text2',
    borderClass: 'border-border',
    textClass: 'text-text2',
    icon: null,
  }

  const isX = content.platform === 'x'
  const tweets = isX
    ? content.content.split(/\n?---\n?/).map((t) => t.trim()).filter(Boolean)
    : []

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
    <div className={[
      'rounded-xl border overflow-hidden flex flex-col',
      isPublished ? 'border-greenb/50' : 'border-border',
      'bg-bg2',
    ].join(' ')}>
      {/* Card header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-bg border-b border-border">
        <div className="flex items-center gap-2">
          <div className={['w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', meta.bgClass].join(' ')}>
            {meta.icon}
          </div>
          <span className="text-xs font-semibold text-text">{meta.label}</span>
          {isX && tweets.length > 1 && (
            <span className="text-[10px] text-text3 bg-bg2 border border-border rounded-full px-2 py-0.5">
              {tweets.length} tweets
            </span>
          )}
        </div>

        {/* Status badge */}
        {isPublished && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-greenl border border-greenb">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-[10px] font-semibold text-green">Published</span>
          </div>
        )}
        {isFailed && (
          <div className="px-2 py-0.5 rounded-full bg-redl border border-red/20">
            <span className="text-[10px] font-semibold text-red">Failed</span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 p-3.5">
        {editing ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full min-h-[160px] p-3 rounded-lg border border-border bg-bg text-text text-sm leading-relaxed resize-y outline-none focus:border-border2 font-[inherit] box-border transition-colors duration-150"
          />
        ) : isX && tweets.length > 1 ? (
          <div className="space-y-0">
            {tweets.map((tweet, i) => (
              <TweetCard key={i} text={tweet} index={i} total={tweets.length} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
            {content.content}
          </p>
        )}

        {/* Error */}
        {isFailed && content.error_message && (
          <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-redl border border-red/20">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red flex-shrink-0 mt-px">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-xs text-red leading-snug">{content.error_message}</p>
          </div>
        )}

        {/* Refine bar */}
        {editing && (
          <div className="flex gap-1.5 mt-3">
            <input
              type="text"
              placeholder="Refine: make it punchier, add a hook…"
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg text-text text-xs outline-none focus:border-border2 font-[inherit] placeholder:text-text3 transition-colors duration-150"
            />
            <button
              onClick={handleRefine}
              disabled={!refineInstruction.trim() || refining}
              className={[
                'px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap',
                refineInstruction.trim() && !refining
                  ? 'bg-text text-bg hover:opacity-90 cursor-pointer'
                  : 'bg-bg3 text-text3 cursor-not-allowed',
              ].join(' ')}
            >
              {refining ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-bg/30 border-t-bg animate-spin-fast block" />
              ) : 'Refine'}
            </button>
          </div>
        )}
      </div>

      {/* Action footer */}
      {!isPublished && (
        <div className="px-3.5 pb-3.5 flex gap-2">
          <button
            onClick={() => setEditing((v) => !v)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all duration-150',
              editing
                ? 'border-border2 bg-bg3 text-text'
                : 'border-border bg-bg text-text2 hover:border-border2 hover:text-text',
            ].join(' ')}
          >
            {editing ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Done
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </>
            )}
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className={[
              'flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
              !publishing
                ? `${meta.bgClass} text-white hover:opacity-90 active:scale-[0.97] cursor-pointer`
                : 'bg-bg3 text-text3 cursor-not-allowed',
            ].join(' ')}
          >
            {publishing ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-text3/30 border-t-text3 animate-spin-fast" />
                Copying…
              </>
            ) : copied ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Copy &amp; Open {meta.label}
              </>
            )}
          </button>
        </div>
      )}

      {/* Published state footer */}
      {isPublished && (
        <div className="px-3.5 pb-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-green font-medium">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Posted to {meta.label}
          </div>
        </div>
      )}
    </div>
  )
}
