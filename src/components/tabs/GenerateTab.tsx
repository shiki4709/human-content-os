'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Source } from '@/types'
import { toast } from '@/components/Toast'
import RednoteCarousel from '@/components/generate/RednoteCarousel'

const PLATS: Record<string, { name: string; icon: string; lang: string }> = {
  linkedin:  { name: 'LinkedIn',       icon: '💼', lang: 'English' },
  x:         { name: 'X / Twitter',    icon: '𝕏',  lang: 'English — thread' },
  substack:  { name: 'Substack',       icon: '📧', lang: 'English — long form' },
  rednote:   { name: 'Rednote 小红书', icon: '🌸', lang: 'Chinese — culturally adapted' },
  notejp:    { name: 'Note.jp',        icon: '📝', lang: 'Japanese — culturally adapted' },
  instagram: { name: 'Instagram',      icon: '📸', lang: 'English — caption + hashtags' },
}

type Props = {
  sources: Source[]
  brandVoice: string
  tone: string
  enabledPlatforms: Record<string, boolean>
  generatedContent: Record<string, string>
  onGeneratedContentChange: (c: Record<string, string>) => void
  coreInsight: string
  onCoreInsightChange: (i: string) => void
  pendingGenerate: boolean
  onPendingGenerateConsumed: () => void
  onGenerationComplete: (results: Record<string, string>, insight: string) => void
}

function parseXThread(content: string): string[] {
  const parts = content.split(/TWEET_\d+:\s*/i).filter(t => t.trim())
  if (parts.length > 1) return parts.map(t => t.split('|')[0].trim()).filter(Boolean)
  const byPipe = content.split('|').map(t => t.trim()).filter(t => t.length > 10)
  if (byPipe.length > 1) return byPipe
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

export default function GenerateTab({
  sources,
  brandVoice,
  tone,
  enabledPlatforms,
  generatedContent,
  onGeneratedContentChange,
  coreInsight,
  onCoreInsightChange,
  pendingGenerate,
  onPendingGenerateConsumed,
  onGenerationComplete,
}: Props) {
  const [activePlat, setActivePlat] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generatingPlats, setGeneratingPlats] = useState<string[]>([])
  const [refineText, setRefineText] = useState('')
  const [refining, setRefining] = useState(false)
  const [showCarousel, setShowCarousel] = useState(false)
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const tweetRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const platforms = Object.keys(enabledPlatforms).filter(k => enabledPlatforms[k])
  const hasContent = Object.keys(generatedContent).length > 0

  // Auto-trigger generation when pendingGenerate becomes true (from ConfigureTab)
  useEffect(() => {
    if (pendingGenerate) {
      onPendingGenerateConsumed()
      handleGenerate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGenerate])

  const getEditedContent = useCallback((pk: string): string => {
    if (pk === 'x') {
      const container = tweetRefs.current[pk]
      if (!container) return generatedContent[pk] || ''
      const tweetEls = container.querySelectorAll<HTMLDivElement>('[data-tweet]')
      const tweets: string[] = []
      tweetEls.forEach(el => tweets.push(el.textContent?.trim() || ''))
      return tweets.filter(Boolean).join('\n\n')
    }
    const el = editorRefs.current[pk]
    return el?.innerText || generatedContent[pk] || ''
  }, [generatedContent])

  async function handleGenerate() {
    const selectedSources = sources.filter(s => s.selected)
    if (selectedSources.length === 0) {
      toast('No sources selected')
      return
    }
    if (platforms.length === 0) {
      toast('Select platforms in Configure')
      return
    }

    setGenerating(true)
    setGeneratingPlats([...platforms])
    setActivePlat(null)
    setShowCarousel(false)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: selectedSources.map(s => ({ label: s.label, content: s.content })),
          platforms,
          brandVoice,
          tone,
        }),
      })

      const data = await res.json()
      if (data.error) {
        toast('Generation failed: ' + data.error)
        setGenerating(false)
        setGeneratingPlats([])
        return
      }

      const results = data.results || {}
      const insight = data.coreInsight || ''
      onGeneratedContentChange(results)
      onCoreInsightChange(insight)
      onGenerationComplete(results, insight)
      setActivePlat(platforms[0])
      toast('Content generated')
    } catch {
      toast('Generation failed — check connection')
    } finally {
      setGenerating(false)
      setGeneratingPlats([])
    }
  }

  // Fix 1: Refine only affects the currently active platform
  async function handleRefine() {
    if (!activePlat) { toast('Select a platform first'); return }
    const instr = refineText.trim()
    if (!instr) return

    const targetPlat = activePlat
    setRefining(true)
    const currentContent = getEditedContent(targetPlat)

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformKey: targetPlat,
          platform: PLATS[targetPlat]?.name || targetPlat,
          content: currentContent,
          instruction: instr,
          isThread: targetPlat === 'x',
        }),
      })

      const data = await res.json()
      if (data.error) {
        toast('Refinement failed: ' + data.error)
        return
      }

      // Only update the targeted platform's content
      onGeneratedContentChange({ ...generatedContent, [targetPlat]: data.content })
      setRefineText('')
      toast(`Refined ${PLATS[targetPlat]?.name || targetPlat}`)
    } catch {
      toast('Refinement failed')
    } finally {
      setRefining(false)
    }
  }

  function handleContentEdit(pk: string) {
    const content = getEditedContent(pk)
    onGeneratedContentChange({ ...generatedContent, [pk]: content })
  }

  function renderEditor(pk: string) {
    const content = generatedContent[pk]
    if (!content) return null
    const cfg = PLATS[pk]
    if (!cfg) return null

    if (pk === 'x') {
      const tweets = parseXThread(content)
      return (
        <div
          className={`plat-editor flex-1 flex flex-col overflow-hidden ${activePlat === pk ? '' : 'hidden'}`}
          key={pk}
        >
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-shrink-0">
            <span className="text-[15px]">{cfg.icon}</span>
            <span className="text-[13px] font-semibold text-text">{cfg.name}</span>
            <span className="text-[11px] text-text3">{cfg.lang}</span>
          </div>
          <div
            className="flex-1 overflow-y-auto p-5"
            ref={el => { tweetRefs.current[pk] = el }}
          >
            {tweets.map((tweet, i) => (
              <TweetCard
                key={i}
                index={i}
                text={tweet}
                onBlur={() => handleContentEdit(pk)}
              />
            ))}
            <button
              onClick={() => {
                const updated = content + '\n\nTWEET_' + (tweets.length + 1) + ': '
                onGeneratedContentChange({ ...generatedContent, [pk]: updated })
              }}
              className="mt-2 text-xs text-text3 hover:text-text2 transition-colors"
            >
              + Add tweet
            </button>
          </div>
        </div>
      )
    }

    return (
      <div
        className={`plat-editor flex-1 flex flex-col overflow-hidden ${activePlat === pk ? '' : 'hidden'}`}
        key={pk}
      >
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-shrink-0">
          <span className="text-[15px]">{cfg.icon}</span>
          <span className="text-[13px] font-semibold text-text">{cfg.name}</span>
          <span className="text-[11px] text-text3">{cfg.lang}</span>
          {pk === 'rednote' && hasContent && (
            <button
              onClick={() => setShowCarousel(!showCarousel)}
              className="ml-auto text-xs px-2.5 py-1 rounded-full border border-border2 text-text2 hover:border-accent hover:text-accent transition-all"
            >
              {showCarousel ? '← Text' : '🖼 Generate image'}
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {pk === 'rednote' && showCarousel ? (
            <RednoteCarousel content={content} />
          ) : (
            <div className="p-5">
              <div
                ref={el => { editorRefs.current[pk] = el }}
                contentEditable
                suppressContentEditableWarning
                onBlur={() => handleContentEdit(pk)}
                className="text-[14px] leading-relaxed text-text outline-none min-h-[200px] whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: escapeHtml(content) }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-2 border-t border-border flex-shrink-0">
          <span className="text-[11px] text-text3">{content.length} chars</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Left sidebar */}
      <div className="w-[220px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="p-3.5 px-4 border-b border-border flex-shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-[.07em] text-text3 mb-2.5">
            Platforms
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-2.5 rounded-[9px] bg-text text-bg font-semibold text-[13px] transition-all hover:bg-[#2a2926] flex items-center justify-center gap-[7px] disabled:opacity-50"
          >
            {generating ? (
              <>
                <span className="w-3 h-3 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>✦ {hasContent ? 'Regenerate' : 'Generate'}</>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">
          {platforms.length === 0 ? (
            <div className="px-3 py-3 text-xs text-text3">No platforms selected</div>
          ) : (
            platforms.map(pk => {
              const cfg = PLATS[pk]
              if (!cfg) return null
              const isGenerating = generatingPlats.includes(pk)
              const isDone = !!generatedContent[pk]
              const isActive = activePlat === pk

              return (
                <button
                  key={pk}
                  onClick={() => { if (isDone) setActivePlat(pk) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all mb-0.5 ${
                    isActive
                      ? 'bg-bg3 text-text'
                      : isDone
                        ? 'text-text2 hover:bg-bg2 cursor-pointer'
                        : 'text-text3 cursor-default'
                  }`}
                >
                  <span className="text-[14px]">{cfg.icon}</span>
                  <span className="text-[12.5px] font-medium flex-1">{cfg.name}</span>
                  {isGenerating && (
                    <span className="w-3 h-3 border-[1.5px] border-text3 border-t-transparent rounded-full animate-spin" />
                  )}
                  {isDone && !isGenerating && (
                    <span className="w-2 h-2 rounded-full bg-green flex-shrink-0" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Core insight strip */}
        {coreInsight && !generating && (
          <div className="px-5 py-2.5 border-b border-border bg-bg2 flex-shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-[.07em] text-text3 mb-1">Core insight</div>
            <div className="text-[13px] text-text2 leading-relaxed">{coreInsight}</div>
          </div>
        )}

        {/* Editor content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {generating ? (
            // Loading state inside Generate tab (Fix 3)
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-10">
              <div className="w-8 h-8 border-[2.5px] border-border2 border-t-accent rounded-full animate-spin" />
              <div className="font-serif text-xl text-text2">Generating content…</div>
              <div className="text-[13px] text-text3 leading-relaxed max-w-[300px]">
                Creating platform-native posts from your sources. This takes 10-20 seconds.
              </div>
            </div>
          ) : !hasContent ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-10">
              <div className="text-[36px] opacity-[.18] mb-1.5">✦</div>
              <div className="font-serif text-xl text-text2">Ready to generate</div>
              <div className="text-[13px] text-text3 leading-relaxed max-w-[300px]">
                Select your sources, configure platforms, then hit Generate.
              </div>
            </div>
          ) : !activePlat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-10">
              <div className="text-[13px] text-text3">Select a platform from the sidebar</div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col">
              {platforms.map(pk => renderEditor(pk))}
            </div>
          )}
        </div>

        {/* Refine bar — only for active platform */}
        {hasContent && activePlat && !generating && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-border flex-shrink-0 bg-bg">
            <span className="text-[11px] text-text3 flex-shrink-0">
              {PLATS[activePlat]?.icon} {PLATS[activePlat]?.name}
            </span>
            <input
              type="text"
              value={refineText}
              onChange={e => setRefineText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRefine() }}
              placeholder="e.g. &quot;make it punchier&quot;, &quot;add a hook&quot;, &quot;shorter&quot;…"
              className="flex-1 text-[13px] text-text bg-bg2 border border-border rounded-lg px-3 py-2 outline-none transition-colors focus:border-accent placeholder:text-text3"
            />
            <button
              onClick={handleRefine}
              disabled={refining || !refineText.trim()}
              className="px-4 py-2 rounded-lg bg-text text-bg text-[13px] font-medium transition-all hover:bg-[#2a2926] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {refining && (
                <span className="w-3 h-3 border-2 border-bg border-t-transparent rounded-full animate-spin" />
              )}
              Refine →
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function TweetCard({ index, text, onBlur }: { index: number; text: string; onBlur: () => void }) {
  const [charCount, setCharCount] = useState(text.length)

  return (
    <div className="mb-3 rounded-lg border border-border bg-bg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg2">
        <span className="text-[12px] font-medium text-text2">{index + 1}/</span>
        <span className={`text-[11px] ${charCount > 280 ? 'text-red font-medium' : 'text-text3'}`}>
          {charCount}/280
        </span>
      </div>
      <div
        data-tweet
        contentEditable
        suppressContentEditableWarning
        onInput={e => setCharCount((e.target as HTMLDivElement).textContent?.length || 0)}
        onBlur={onBlur}
        className="px-3 py-2.5 text-[13.5px] leading-relaxed text-text outline-none min-h-[60px]"
        dangerouslySetInnerHTML={{ __html: escapeHtml(text) }}
      />
    </div>
  )
}
