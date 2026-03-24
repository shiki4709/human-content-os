'use client'

import { useState } from 'react'
import type { Source, GeneratedContent } from '@/types'
import PlatformCard from './PlatformCard'

const ANGLE_META: Record<string, { emoji: string; label: string }> = {
  key_insight: { emoji: '💡', label: 'Key Insight' },
  story: { emoji: '📖', label: 'Story' },
  data_point: { emoji: '📊', label: 'Data Point' },
  framework: { emoji: '🔧', label: 'Framework' },
  contrarian_take: { emoji: '🔥', label: 'Contrarian Take' },
  how_to: { emoji: '📋', label: 'How-To' },
  quote: { emoji: '💬', label: 'Quote' },
}

interface AngleRowProps {
  source: Source
  content: GeneratedContent[]
  onPublish: (id: string) => Promise<void>
  onRefine: (id: string, instruction: string) => Promise<void>
  onDelete: (sourceId: string) => Promise<void>
  onDeleteContent?: (id: string) => Promise<void>
  onRegenerate?: (id: string) => Promise<void>
}

export default function AngleRow({ source, content, onPublish, onRefine, onDelete, onDeleteContent, onRegenerate }: AngleRowProps) {
  const [expanded, setExpanded] = useState(false)

  const meta = source.meta as Record<string, unknown> | null
  const angleType = (meta?.angle_type as string) || ''
  const angleMeta = ANGLE_META[angleType]

  const labelParts = source.label.split(' — ')
  const angleTitle = labelParts.length > 1 ? labelParts[1] : source.label

  const allPublished = content.length > 0 && content.every((c) => c.status === 'published')
  const publishedCount = content.filter((c) => c.status === 'published').length

  return (
    <div className="border border-border rounded-xl bg-bg overflow-hidden">
      {/* Compact row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg2 transition-colors duration-150 text-left"
      >
        {/* Angle emoji */}
        <span className="text-base flex-shrink-0">{angleMeta?.emoji || '🔗'}</span>

        {/* Title + type */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text truncate">{angleTitle}</p>
          {angleMeta && (
            <p className="text-[10px] text-text3 mt-0.5">{angleMeta.label}</p>
          )}
        </div>

        {/* Platform status pills */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {content.map((c) => (
            <span
              key={c.id}
              className={[
                'text-[10px] font-semibold px-2 py-0.5 rounded-md',
                c.status === 'published'
                  ? 'bg-green/10 text-green border border-green/20'
                  : 'bg-bg3 text-text3 border border-border',
              ].join(' ')}
            >
              {c.platform === 'linkedin' ? 'LI' : c.platform === 'x' ? 'X' : c.platform === 'rednote' ? 'RN' : 'Note'}
            </span>
          ))}
        </div>

        {/* Status */}
        {allPublished ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green flex-shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : publishedCount > 0 ? (
          <span className="text-[10px] text-text3 flex-shrink-0">{publishedCount}/{content.length}</span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={['flex-shrink-0 transition-transform duration-150', expanded ? 'rotate-180' : ''].join(' ')} style={{ color: 'var(--text3)' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* Platform cards — always mounted, hidden when collapsed */}
      <div className={expanded ? 'px-4 pb-4 pt-1 border-t border-border bg-bg2' : 'hidden'}>
        <div className="flex items-center justify-end mb-3">
          <button
            onClick={() => onDelete(source.id)}
            className="text-[10px] text-text3 hover:text-red transition-colors"
          >
            Delete angle
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {content.map((item) => (
            <PlatformCard
              key={item.id}
              content={item}
              onPublish={onPublish}
              onRefine={onRefine}
              onDeleteContent={onDeleteContent}
              onRegenerate={onRegenerate}
              visible={expanded}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
