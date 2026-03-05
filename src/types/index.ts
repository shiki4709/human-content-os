export type SourceType = 'url' | 'search' | 'youtube' | 'twitter' | 'notes'

export interface Source {
  id: string
  user_id: string
  type: SourceType
  label: string
  content: string
  meta: Record<string, unknown> | null
  selected: boolean
  created_at: string
}

export interface GeneratedContent {
  id: string
  user_id: string
  platform: string
  content: string
  status: 'draft' | 'published'
  created_at: string
}

export interface PublishEntry {
  id: string
  user_id: string
  platform: string
  content: string
  status: 'published' | 'draft'
  platform_post_id: string | null
  created_at: string
}

export type Platform = 'linkedin' | 'x' | 'substack' | 'rednote' | 'notejp' | 'instagram'

export const BADGE_STYLES: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  search:  { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', icon: '🔍', label: 'Web search' },
  youtube: { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', icon: '▶️', label: 'YouTube' },
  url:     { bg: 'bg-[#dbeafe]', text: 'text-[#1e40af]', icon: '🔗', label: 'URL' },
  text:    { bg: 'bg-[#d1fae5]', text: 'text-[#065f46]', icon: '📝', label: 'Notes' },
  notes:   { bg: 'bg-[#d1fae5]', text: 'text-[#065f46]', icon: '📝', label: 'Notes' },
  twitter: { bg: 'bg-[#e0e7ff]', text: 'text-[#3730a3]', icon: '𝕏', label: 'X / Twitter' },
}
