'use client'

import type { Source } from '@/types'
import { BADGE_STYLES } from '@/types'

interface Props {
  source: Source
  onToggleSelect: (id: string) => void
  onDelete: (id: string) => void
}

export default function SourceCard({ source, onToggleSelect, onDelete }: Props) {
  const badge = BADGE_STYLES[source.type] || BADGE_STYLES.notes
  const preview = source.content.slice(0, 220) + (source.content.length > 220 ? '…' : '')

  return (
    <div
      onClick={() => onToggleSelect(source.id)}
      className={`bg-bg border-[1.5px] rounded-[11px] overflow-hidden cursor-pointer transition-all relative hover:shadow-[0_4px_14px_rgba(0,0,0,.07)] hover:border-border2 ${
        source.selected
          ? 'border-accent shadow-[0_0_0_3px_#eff4ff]'
          : 'border-border'
      }`}
    >
      {/* Selected checkmark */}
      {source.selected && (
        <div className="absolute top-[9px] right-[9px] w-[18px] h-[18px] rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center z-10">
          ✓
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-2 py-2.5 px-3 border-b border-border">
        <span className={`text-[11px] font-semibold py-[2px] px-2 rounded-full flex-shrink-0 ${badge.bg} ${badge.text}`}>
          {badge.icon} {badge.label}
        </span>
        <span className="text-[13px] font-medium flex-1 whitespace-nowrap overflow-hidden text-ellipsis pr-5">
          {source.label}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(source.id) }}
          className={`w-5 h-5 rounded flex items-center justify-center text-text3 text-[11px] cursor-pointer transition-all hover:bg-redl hover:text-red ${
            source.selected ? 'right-8' : ''
          }`}
        >
          ✕
        </button>
      </div>

      {/* Preview text */}
      <div className="py-2.5 px-3 text-[12.5px] leading-[1.58] text-text2 line-clamp-3">
        {preview}
      </div>

      {/* Footer */}
      <div className="py-[7px] px-3 border-t border-border flex justify-between items-center">
        <span className="text-[11px] text-text3">{source.content.length} chars</span>
        <span className={`text-[11px] ${source.selected ? 'text-accent font-medium' : 'text-text3'}`}>
          {source.selected ? '✓ Selected' : 'Click to select'}
        </span>
      </div>
    </div>
  )
}
