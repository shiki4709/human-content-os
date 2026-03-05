'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Source } from '@/types'
import SourcesTab from './tabs/SourcesTab'
import ConfigureTab from './tabs/ConfigureTab'
import GenerateTab from './tabs/GenerateTab'
import PublishTab from './tabs/PublishTab'
import ToastContainer from './Toast'

type Tab = 'sources' | 'configure' | 'generate' | 'publish'

const TABS: { key: Tab; label: string; num: number }[] = [
  { key: 'sources', label: 'Sources', num: 1 },
  { key: 'configure', label: 'Configure', num: 2 },
  { key: 'generate', label: 'Generate', num: 3 },
  { key: 'publish', label: 'Publish', num: 4 },
]

const DEFAULT_PLATFORMS: Record<string, boolean> = {
  linkedin: true,
  x: true,
  substack: true,
  rednote: true,
  notejp: false,
  instagram: false,
}

export default function DashboardShell({
  user,
  children,
}: {
  user: User
  children: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<Tab>('sources')
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, boolean>>({})
  const [sources, setSources] = useState<Source[]>([])
  const [brandVoice, setBrandVoice] = useState('')
  const [tone, setTone] = useState('Thought leader')
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<string, boolean>>(DEFAULT_PLATFORMS)
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({})
  const [coreInsight, setCoreInsight] = useState('')
  const [pendingGenerate, setPendingGenerate] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Load sources from Supabase on mount
  const loadSources = useCallback(async () => {
    if (!user || user.id === 'dev') return
    try {
      const { data } = await supabase
        .from('sources')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (data) setSources(data as Source[])
    } catch {
      // Supabase not configured or table not created yet
    }
  }, [user, supabase])

  useEffect(() => {
    loadSources()
  }, [loadSources])

  // Handle OAuth return — auto-switch to publish tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'publish') {
      setActiveTab('publish')
    }
  }, [])

  // Persist sources to Supabase
  async function handleSourcesChange(newSources: Source[]) {
    const prev = sources
    setSources(newSources)

    if (!user || user.id === 'dev') return

    // Determine what changed
    const prevIds = new Set(prev.map(s => s.id))
    const newIds = new Set(newSources.map(s => s.id))

    // Added sources
    const added = newSources.filter(s => !prevIds.has(s.id))
    for (const s of added) {
      try {
        await supabase.from('sources').insert({
          id: s.id,
          user_id: user.id,
          type: s.type,
          label: s.label,
          content: s.content,
          meta: s.meta,
          selected: s.selected,
        })
      } catch { /* table may not exist yet */ }
    }

    // Deleted sources
    const deleted = prev.filter(s => !newIds.has(s.id))
    for (const s of deleted) {
      try {
        await supabase.from('sources').delete().eq('id', s.id)
      } catch { /* ignore */ }
    }

    // Updated sources (selected toggle)
    const updated = newSources.filter(s => {
      const old = prev.find(p => p.id === s.id)
      return old && old.selected !== s.selected
    })
    for (const s of updated) {
      try {
        await supabase.from('sources').update({ selected: s.selected }).eq('id', s.id)
      } catch { /* ignore */ }
    }
  }

  // Navigate to Generate tab and trigger generation
  function handleRequestGenerate() {
    setActiveTab('generate')
    setPendingGenerate(true)
  }

  // Save generated content to Supabase
  async function handleGenerationComplete(results: Record<string, string>, insight: string) {
    setGeneratedContent(results)
    setCoreInsight(insight)

    if (!user || user.id === 'dev') return

    for (const [platform, content] of Object.entries(results)) {
      try {
        await supabase.from('generated_content').upsert({
          id: crypto.randomUUID(),
          user_id: user.id,
          platform,
          content,
          status: 'draft',
        })
      } catch { /* table may not exist yet */ }
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const connectedKeys = Object.keys(connectedAccounts).filter(k => connectedAccounts[k])
  const sourceCount = sources.length
  const sourceBadge = sourceCount > 0 ? sourceCount : null

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* TOPBAR */}
      <div className="h-[50px] flex items-center justify-between px-6 border-b border-border flex-shrink-0">
        <div className="font-serif text-[19px] tracking-tight">
          Human <span className="font-sans text-xs text-text3 ml-1.5 not-italic">content OS</span>
        </div>
        <div className="flex items-center gap-2">
          {connectedKeys.length > 0 ? (
            connectedKeys.map(k => (
              <span
                key={k}
                className="flex items-center gap-[5px] px-2.5 py-[3px] rounded-full border border-border text-xs text-text2 cursor-pointer transition-all hover:border-red hover:text-red"
              >
                <span className="w-[5px] h-[5px] rounded-full bg-green" />
                {k === 'linkedin' ? 'LinkedIn' : k === 'x' ? 'X' : 'Substack'}
              </span>
            ))
          ) : (
            <span className="text-xs text-text3">No accounts connected</span>
          )}
          <button
            onClick={handleLogout}
            className="ml-2 text-xs text-text3 hover:text-red transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* TABNAV */}
      <div className="h-[44px] flex items-stretch border-b border-border flex-shrink-0 px-6 gap-0">
        {TABS.map((tab, i) => (
          <div key={tab.key} className="flex items-center">
            {i > 0 && (
              <span className="text-border2 text-[11px] flex items-center mx-1">→</span>
            )}
            <button
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-[7px] px-1 h-[44px] border-b-2 cursor-pointer text-[13px] font-medium mr-0.5 transition-all select-none relative whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-text border-b-text'
                  : 'text-text3 border-b-transparent hover:text-text2'
              }`}
            >
              <span
                className="w-[19px] h-[19px] rounded-full border-[1.5px] border-current flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              >
                {tab.num}
              </span>
              {tab.label}
              {/* Source badge */}
              {tab.key === 'sources' && sourceBadge && (
                <span className="absolute top-[6px] -right-2 min-w-[15px] h-[15px] rounded-lg bg-accent text-white text-[9px] font-bold flex items-center justify-center px-[3px]">
                  {sourceBadge}
                </span>
              )}
            </button>
          </div>
        ))}
        <div className="flex-1" />
      </div>

      {/* PAGES */}
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === 'sources' ? 'flex flex-col h-full' : 'hidden'}>
          <SourcesTab
            onNavigate={setActiveTab}
            sources={sources}
            onSourcesChange={handleSourcesChange}
          />
        </div>
        <div className={activeTab === 'configure' ? 'flex flex-row h-full' : 'hidden'}>
          <ConfigureTab
            onNavigate={setActiveTab}
            sources={sources}
            brandVoice={brandVoice}
            onBrandVoiceChange={setBrandVoice}
            tone={tone}
            onToneChange={setTone}
            enabledPlatforms={enabledPlatforms}
            onEnabledPlatformsChange={setEnabledPlatforms}
            onRequestGenerate={handleRequestGenerate}
          />
        </div>
        <div className={activeTab === 'generate' ? 'flex flex-row h-full' : 'hidden'}>
          <GenerateTab
            sources={sources}
            brandVoice={brandVoice}
            tone={tone}
            enabledPlatforms={enabledPlatforms}
            generatedContent={generatedContent}
            onGeneratedContentChange={setGeneratedContent}
            coreInsight={coreInsight}
            onCoreInsightChange={setCoreInsight}
            pendingGenerate={pendingGenerate}
            onPendingGenerateConsumed={() => setPendingGenerate(false)}
            onGenerationComplete={handleGenerationComplete}
          />
        </div>
        <div className={activeTab === 'publish' ? 'flex flex-col h-full' : 'hidden'}>
          <PublishTab
            onNavigate={setActiveTab}
            generatedContent={generatedContent}
            enabledPlatforms={enabledPlatforms}
            onConnectionsChange={setConnectedAccounts}
          />
        </div>
      </div>

      {children}
      <ToastContainer />
    </div>
  )
}
