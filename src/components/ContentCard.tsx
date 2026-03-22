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
    <div
      style={{
        backgroundColor: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '1.25rem',
      }}
    >
      {/* Source header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          gap: '1rem',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '0.2rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {source.label}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
            From Substack · {timeAgo(sourceDate)}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {allPublished && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgb(34,197,94)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: '0.75rem', color: 'rgb(34,197,94)', fontWeight: 600 }}>
                All published
              </span>
            </div>
          )}
          <button
            onClick={() => onDelete(source.id)}
            title="Delete"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text3)',
              fontSize: '0.875rem',
              lineHeight: 1,
            }}
          >
            &#x2715;
          </button>
        </div>
      </div>

      {/* Platform cards grid */}
      {content.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>
          No generated content yet.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.875rem',
          }}
        >
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
  )
}
