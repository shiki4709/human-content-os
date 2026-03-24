'use client'

import type { Source, GeneratedContent } from '@/types'
import PlatformCard from './PlatformCard'

interface ContentCardProps {
  source: Source
  content: GeneratedContent[]
  onPublish: (id: string) => Promise<void>
  onRefine: (id: string, instruction: string) => Promise<void>
  onDelete: (sourceId: string) => Promise<void>
  onDeleteContent?: (id: string) => Promise<void>
  onRegenerate?: (id: string) => Promise<void>
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// Angle type metadata
const ANGLE_META: Record<string, { emoji: string; label: string }> = {
  key_insight: { emoji: '💡', label: 'Key Insight' },
  story: { emoji: '📖', label: 'Story' },
  data_point: { emoji: '📊', label: 'Data Point' },
  framework: { emoji: '🔧', label: 'Framework' },
  contrarian_take: { emoji: '🔥', label: 'Contrarian Take' },
  how_to: { emoji: '📋', label: 'How-To' },
  quote: { emoji: '💬', label: 'Quote' },
}

// Static viral scores removed — AI-powered scoring is now in PlatformCard

export default function ContentCard({ source, content, onPublish, onRefine, onDelete, onDeleteContent, onRegenerate }: ContentCardProps) {
  const allPublished = content.length > 0 && content.every((c) => c.status === 'published')
  const sourceDate = source.rss_published_at ?? source.created_at
  const meta = source.meta as Record<string, unknown> | null
  const angleType = (meta?.angle_type as string) || ''
  const angleMeta = ANGLE_META[angleType]

  // Parse the title — if it contains " — " it's "Article Title — Angle Title"
  const labelParts = source.label.split(' — ')
  const articleTitle = labelParts.length > 1 ? labelParts[0] : source.label
  const angleTitle = labelParts.length > 1 ? labelParts[1] : null

  // Keep platform order as-is (don't sort across platforms — scores are not comparable)
  const sortedContent = content

  return (
    <div className="bg-bg rounded-2xl border border-border shadow-sm overflow-hidden animate-fade-up mb-4">
      {/* Source header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-bg2 gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Angle icon */}
          <div className="w-9 h-9 rounded-xl bg-bg3 flex items-center justify-center flex-shrink-0 text-base">
            {angleMeta?.emoji || '🔗'}
          </div>

          <div className="flex-1 min-w-0">
            {/* Angle title (what this post is about) */}
            {angleTitle ? (
              <>
                <h3 className="text-sm font-semibold text-text leading-snug">
                  {angleTitle}
                </h3>
                <p className="text-[11px] text-text3 mt-0.5 truncate">
                  {angleMeta && (
                    <span className="font-medium">{angleMeta.label}</span>
                  )}
                  {angleMeta && ' · '}
                  {articleTitle} · {timeAgo(sourceDate)}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-text leading-snug truncate">
                  {source.label}
                </h3>
                <p className="text-[11px] text-text3 mt-0.5">
                  {timeAgo(sourceDate)}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {allPublished && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-greenl border border-greenb">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-[10px] font-semibold text-green">Done</span>
            </div>
          )}
          <button
            onClick={() => onDelete(source.id)}
            title="Delete"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text3 hover:text-text hover:bg-bg3 transition-all duration-150"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Platform cards with viral indicators */}
      <div className="p-4">
        {content.length === 0 ? (
          <p className="text-xs text-text3 text-center py-6">No generated content yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sortedContent.map((item) => (
              <PlatformCard
                key={item.id}
                content={item}
                onPublish={onPublish}
                onRefine={onRefine}
                onDeleteContent={onDeleteContent}
                onRegenerate={onRegenerate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
