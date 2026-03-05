'use client'

export default function PublishTab() {
  return (
    <>
      {/* Connection bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-shrink-0 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mr-1">
          Accounts
        </span>
        <div className="flex items-center gap-[5px] px-3 py-[5px] rounded-full border border-border text-xs font-medium cursor-pointer transition-all text-text2 hover:border-accent hover:text-accent">
          <span>💼</span>LinkedIn
        </div>
        <div className="flex items-center gap-[5px] px-3 py-[5px] rounded-full border border-border text-xs font-medium cursor-pointer transition-all text-text2 hover:border-accent hover:text-accent">
          <span>𝕏</span>X / Twitter
        </div>
        <div className="flex items-center gap-[5px] px-3 py-[5px] rounded-full border border-border text-xs font-medium cursor-pointer transition-all text-text2 hover:border-accent hover:text-accent">
          <span>📧</span>Substack
        </div>
        <div className="flex items-center gap-[5px] px-3 py-[5px] rounded-full border border-border text-xs font-medium opacity-60 cursor-default">
          <span>🌸</span>Rednote <span className="text-[10px] text-text3 ml-0.5">copy &amp; paste</span>
        </div>
        <div className="flex items-center gap-[5px] px-3 py-[5px] rounded-full border border-border text-xs font-medium opacity-50 cursor-default">
          <span>📝</span>Note.jp <span className="text-[10px] opacity-70">soon</span>
        </div>
        <div className="flex items-center gap-[5px] px-3 py-[5px] rounded-full border border-border text-xs font-medium opacity-50 cursor-default">
          <span>📸</span>Instagram <span className="text-[10px] opacity-70">soon</span>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="font-serif text-lg">Published content</div>
          <button className="inline-flex items-center justify-center gap-1.5 font-sans text-xs font-medium px-3.5 py-[7px] rounded-lg border border-border2 bg-bg text-text2 transition-all hover:border-border2 hover:text-text hover:bg-bg2">
            ← Back to Generate
          </button>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-[60px] text-center gap-2">
          <div className="text-[32px] opacity-20 mb-1">📬</div>
          <div className="font-serif text-lg text-text2">Nothing published yet</div>
          <div className="text-[13px] text-text3 leading-relaxed max-w-[280px]">
            Generate content then send to each platform. It&apos;ll show up here to track and manage.
          </div>
        </div>
      </div>
    </>
  )
}
