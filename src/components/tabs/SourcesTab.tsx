'use client'

import { useState } from 'react'
import type { Source, SourceType } from '@/types'
import AddSourceModal from '@/components/sources/AddSourceModal'
import SourceCard from '@/components/sources/SourceCard'
import { toast } from '@/components/Toast'

type Props = {
  onNavigate: (tab: 'sources' | 'repurpose' | 'configure' | 'generate' | 'publish') => void
  sources: Source[]
  onSourcesChange: (sources: Source[]) => void
}

export default function SourcesTab({ onNavigate, sources, onSourcesChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const selectedCount = sources.filter(s => s.selected).length
  const pillText = `${sources.length} source${sources.length !== 1 ? 's' : ''} · ${selectedCount} selected`

  function handleAdd(src: { type: SourceType; label: string; content: string }) {
    const newSource: Source = {
      id: crypto.randomUUID(),
      user_id: '',
      type: src.type,
      label: src.label,
      content: src.content,
      meta: null,
      selected: true,
      rss_guid: null,
      rss_published_at: null,
      created_at: new Date().toISOString(),
    }
    onSourcesChange([...sources, newSource])
    toast('✓ Source added — ' + src.label)
  }

  function handleToggleSelect(id: string) {
    onSourcesChange(
      sources.map(s => s.id === id ? { ...s, selected: !s.selected } : s)
    )
  }

  function handleDelete(id: string) {
    onSourcesChange(sources.filter(s => s.id !== id))
    toast('Source removed')
  }

  return (
    <>
      {/* Source bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0 gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-text2 bg-bg3 px-2.5 py-[3px] rounded-full">
            {pillText}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate('configure')}
            className="inline-flex items-center justify-center gap-1.5 font-sans text-[13px] font-medium px-4 py-2 rounded-lg border border-border2 bg-bg text-text2 transition-all hover:border-border2 hover:text-text hover:bg-bg2"
          >
            Configure →
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 font-sans text-[13px] font-semibold px-4 py-2 rounded-lg bg-text text-bg border border-text shadow-sm transition-all hover:bg-[#2a2926]"
          >
            ＋ Add source
          </button>
        </div>
      </div>

      {/* Source grid or empty state */}
      <div className="flex-1 overflow-y-auto p-[18px] px-6">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[60px] text-center gap-2">
            <div className="text-[32px] opacity-20 mb-1">📚</div>
            <div className="font-serif text-xl text-text2">No sources yet</div>
            <div className="text-[13px] text-text3 leading-relaxed max-w-[340px]">
              Describe what you want in plain language — &quot;top AI news past 7 days&quot;,
              &quot;latest Lex Fridman video&quot;, or paste your own notes.
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-3 inline-flex items-center justify-center gap-1.5 font-sans text-[13px] font-semibold px-4 py-2 rounded-lg bg-text text-bg border border-text shadow-sm transition-all hover:bg-[#2a2926]"
            >
              ＋ Add first source
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-2.5 content-start">
            {sources.map(s => (
              <SourceCard
                key={s.id}
                source={s}
                onToggleSelect={handleToggleSelect}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <AddSourceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAdd}
      />
    </>
  )
}
