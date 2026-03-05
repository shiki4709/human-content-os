'use client'

import type { Source } from '@/types'
import { BADGE_STYLES } from '@/types'
import { toast } from '@/components/Toast'

type Props = {
  onNavigate: (tab: 'sources' | 'configure' | 'generate' | 'publish') => void
  sources: Source[]
  brandVoice: string
  onBrandVoiceChange: (v: string) => void
  tone: string
  onToneChange: (t: string) => void
  enabledPlatforms: Record<string, boolean>
  onEnabledPlatformsChange: (p: Record<string, boolean>) => void
  onRequestGenerate: () => void
}

const TONES = ['Thought leader', 'Casual founder', 'Storyteller', 'Professional']

const PLATFORMS = [
  { key: 'linkedin', icon: '💼', name: 'LinkedIn', desc: 'English', default: true },
  { key: 'x', icon: '𝕏', name: 'X / Twitter', desc: 'English — thread format', default: true },
  { key: 'substack', icon: '📧', name: 'Substack', desc: 'English — long form', default: true },
  { key: 'rednote', icon: '🌸', name: 'Rednote 小红书', desc: 'Chinese — culturally adapted', default: true },
  { key: 'notejp', icon: '📝', name: 'Note.jp', desc: 'Japanese — culturally adapted', default: false },
  { key: 'instagram', icon: '📸', name: 'Instagram', desc: 'English — caption + hashtags', default: false },
]

export default function ConfigureTab({
  onNavigate,
  sources,
  brandVoice,
  onBrandVoiceChange,
  tone,
  onToneChange,
  enabledPlatforms,
  onEnabledPlatformsChange,
  onRequestGenerate,
}: Props) {
  const selectedSources = sources.filter(s => s.selected)

  function togglePlatform(key: string) {
    onEnabledPlatformsChange({ ...enabledPlatforms, [key]: !enabledPlatforms[key] })
  }

  function handleGenerate() {
    if (selectedSources.length === 0) {
      toast('No sources selected — go back and select some')
      return
    }

    const platforms = Object.keys(enabledPlatforms).filter(k => enabledPlatforms[k])
    if (platforms.length === 0) {
      toast('Select at least one platform')
      return
    }

    onRequestGenerate()
  }

  return (
    <>
      {/* Left column */}
      <div className="flex-1 p-6 px-7 overflow-y-auto border-r border-border">
        {/* Selected sources */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mb-2.5 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-border">
            Selected sources
          </div>
          {selectedSources.length === 0 ? (
            <div className="p-3 rounded-lg border border-dashed border-border2 text-center text-[13px] text-text3">
              No sources selected — go back and select some
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {selectedSources.map(s => {
                const badge = BADGE_STYLES[s.type] || BADGE_STYLES.notes
                return (
                  <div key={s.id} className="flex items-center gap-[7px] py-[7px] px-2.5 rounded-[7px] bg-bg3 text-[12.5px]">
                    <span>{badge.icon}</span>
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{s.label}</span>
                    <span className="text-[11px] text-text3">{s.content.length}c</span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-2.5">
            <button
              onClick={() => onNavigate('sources')}
              className="inline-flex items-center justify-center gap-1.5 font-sans text-xs font-medium px-3.5 py-[7px] rounded-lg border border-border2 bg-bg text-text2 transition-all hover:border-border2 hover:text-text hover:bg-bg2"
            >
              ← Manage sources
            </button>
          </div>
        </div>

        {/* Brand voice */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mb-2.5 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-border">
            Brand voice
          </div>
          <textarea
            rows={3}
            value={brandVoice}
            onChange={e => onBrandVoiceChange(e.target.value)}
            placeholder="e.g. AI startup founder, building for Asian markets, ex-fintech, speaks to other founders…"
            className="w-full font-sans text-[13.5px] text-text bg-bg border border-border rounded-lg px-3 py-2.5 outline-none resize-none leading-relaxed transition-colors focus:border-accent placeholder:text-text3"
          />
        </div>

        {/* Tone */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mb-2.5 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-border">
            Tone
          </div>
          <div className="grid grid-cols-2 gap-[5px]">
            {TONES.map(t => (
              <button
                key={t}
                onClick={() => onToneChange(t)}
                className={`py-2 px-3 rounded-lg border text-[13px] cursor-pointer text-center transition-all ${
                  tone === t
                    ? 'border-acb bg-acl text-accent font-medium'
                    : 'border-border text-text2 hover:border-border2'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="flex-1 p-6 px-7 overflow-y-auto">
        {/* Output platforms */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mb-2.5 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-border">
            Output platforms
          </div>
          {PLATFORMS.map(p => (
            <label
              key={p.key}
              onClick={() => togglePlatform(p.key)}
              className={`flex items-center gap-3 p-2.5 px-3 rounded-[9px] border cursor-pointer transition-all select-none mb-[5px] ${
                enabledPlatforms[p.key]
                  ? 'border-acb bg-acl'
                  : 'border-border hover:border-border2'
              }`}
            >
              <span className="text-[15px] w-5 text-center flex-shrink-0">{p.icon}</span>
              <div className="flex-1">
                <div className={`text-[13px] font-medium ${enabledPlatforms[p.key] ? 'text-accent' : 'text-text2'}`}>
                  {p.name}
                </div>
                <div className={`text-[11px] mt-px ${enabledPlatforms[p.key] ? 'text-[#93b4f8]' : 'text-text3'}`}>
                  {p.desc}
                </div>
              </div>
              <span
                className={`w-[17px] h-[17px] rounded flex items-center justify-center text-[9px] flex-shrink-0 transition-all ${
                  enabledPlatforms[p.key]
                    ? 'bg-accent border-accent text-white border-[1.5px]'
                    : 'border-[1.5px] border-border2 text-transparent'
                }`}
              >
                ✓
              </span>
            </label>
          ))}
        </div>

        {/* CTA */}
        <div className="pt-4 flex justify-end">
          <button
            onClick={handleGenerate}
            className="px-5 py-2.5 rounded-[9px] bg-text text-bg font-semibold text-[13.5px] transition-all hover:bg-[#2a2926] hover:-translate-y-px hover:shadow-md"
          >
            Generate content →
          </button>
        </div>
      </div>
    </>
  )
}
