'use client'

import type { Source, GeneratedContent } from '@/types'
import PlatformCard from './PlatformCard'

interface ContentCardProps {
  source: Source
  content: GeneratedContent[]
  onPublish: (id: string) => Promise<void>
  onRefine: (id: string, instruction: string) => Promise<void>
  onDelete: (sourceId: string) => Promise<void>
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

export default function ContentCard({ source, content, onPublish, onRefine, onDelete }: ContentCardProps) {
  const allPublished = content.length > 0 && content.every((c) => c.status === 'published')
  const sourceDate = source.rss_published_at ?? source.created_at

  return (
    <div className="bg-bg rounded-2xl border border-border shadow-sm overflow-hidden animate-fade-up">
      {/* Source header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-bg2 gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Source icon */}
          <div className="w-8 h-8 rounded-lg bg-bg3 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text3">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text leading-snug truncate">
              {source.label}
            </h3>
            <p className="text-xs text-text3 mt-0.5">
              From Substack · {timeAgo(sourceDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {allPublished && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-greenl border border-greenb">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-[11px] font-semibold text-green">All published</span>
            </div>
          )}
          <button
            onClick={() => onDelete(source.id)}
            title="Delete"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text3 hover:text-text hover:bg-bg3 transition-all duration-150"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Platform cards */}
      <div className="p-4">
        {content.length === 0 ? (
          <p className="text-xs text-text3 text-center py-6">No generated content yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {content.map((item) => (
              <PlatformCard
                key={item.id}
                content={item}
                onPublish={onPublish}
                onRefine={onRefine}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
