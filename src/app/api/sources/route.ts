import { NextRequest, NextResponse } from 'next/server'

// Fetch actual page content and strip HTML to plain text
async function fetchPageContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HumanContentOS/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  // Strip HTML tags, scripts, styles — keep text content
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  // Limit to ~15k chars to stay within Claude's sweet spot
  return cleaned.slice(0, 15000)
}

const PROMPTS: Record<string, (p: Record<string, string>) => string> = {
  url: (p) => {
    if (p.hint === 'substack-newsletter') {
      return `Here is the raw text content extracted from a Substack newsletter (${p.url}):

---
${p.pageContent}
---

This newsletter will be repurposed into social media posts. Extract the FULL article content:
- The main thesis/argument
- All key points and insights (preserve the author's original framing)
- Notable quotes or data points
- The narrative arc and structure

Return the complete article content — do NOT summarize or shorten. Preserve the author's voice and key phrases. Strip out navigation, footer, and subscription prompts.`
    }
    return `Here is the raw text content extracted from a web page (${p.url}):

---
${p.pageContent}
---

Extract the key content: headline, main arguments, key data points, and quotes. 300-600 words.`
  },

  search: (p) => `You are searching the web. Query: "${p.query}" — Time range: ${p.period}.

Return 5-7 specific, realistic findings/headlines with brief context each. Format as a structured digest. 300-600 words.`,
}

// Stub messages for source types that require external API auth
const STUB_MESSAGES: Record<string, (p: Record<string, string>) => string> = {
  twitter: (p) => `Real-time tweets from ${p.handle} cannot be fetched without X API authentication.\n\nTo enable live tweet fetching:\n1. Get X API credentials at developer.x.com\n2. Add X_CLIENT_ID and X_CLIENT_SECRET to .env.local\n3. Restart the dev server\n\nIn the meantime, you can manually paste tweets or notes about ${p.handle}'s recent content here and edit this text.`,

  youtube: (p) => `Videos from "${p.channel}" cannot be fetched without YouTube Data API authentication.\n\nTo enable live video fetching:\n1. Get a YouTube Data API key at console.cloud.google.com\n2. Add YOUTUBE_API_KEY to .env.local\n3. Restart the dev server\n\nIn the meantime, you can manually paste video summaries or notes about ${p.channel}'s recent content here and edit this text.`,
}

const LOADING_MESSAGES: Record<string, string | ((p: Record<string, string>) => string)> = {
  url: 'Fetching page…',
  search: 'Searching the web…',
  youtube: 'Checking YouTube API…',
  twitter: (p) => `Checking ${p.handle}…`,
  notes: 'Processing…',
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { type, extra } = body as { type: string; extra: Record<string, string> }

  // Notes don't need API call — content is already provided
  if (type === 'notes') {
    return NextResponse.json({
      content: extra.content,
      label: 'My notes · ' + new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    })
  }

  // X/Twitter and YouTube: return honest stub instead of fabricating content
  const stubFn = STUB_MESSAGES[type]
  if (stubFn) {
    return NextResponse.json({
      content: stubFn(extra),
      label: getAutoLabel(type, extra),
      loadingMessage: getLoadingMessage(type, extra),
    })
  }

  const promptFn = PROMPTS[type]
  if (!promptFn) {
    return NextResponse.json({ error: 'Unknown source type' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      content: '(Anthropic API key not configured — added as stub. Set ANTHROPIC_API_KEY in .env.local)',
      label: getAutoLabel(type, extra),
      loadingMessage: getLoadingMessage(type, extra),
    })
  }

  // For URL types, fetch actual page content first
  if (type === 'url' && extra.url) {
    try {
      const pageContent = await fetchPageContent(extra.url)
      extra.pageContent = pageContent
    } catch (err) {
      return NextResponse.json({
        content: `(Could not fetch ${extra.url} — ${err instanceof Error ? err.message : 'unknown error'}. Try pasting the content directly as notes instead.)`,
        label: getAutoLabel(type, extra),
      })
    }
  }

  const isNewsletter = extra.hint === 'substack-newsletter'
  const prompt = promptFn(extra)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: isNewsletter ? 3000 : 1500,
        system: 'You are a content extraction agent. Return ONLY the extracted/simulated content — no preamble, no explanation, no meta-commentary. Just the raw content.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()

    if (data.error) {
      console.error('Anthropic API error:', data.error)
      return NextResponse.json({
        content: `(API error: ${data.error.message || JSON.stringify(data.error)})`,
        label: getAutoLabel(type, extra),
        loadingMessage: getLoadingMessage(type, extra),
      })
    }

    const content = data.content?.[0]?.text?.trim() || '(Could not fetch — unexpected response)'

    return NextResponse.json({
      content,
      label: getAutoLabel(type, extra),
      loadingMessage: getLoadingMessage(type, extra),
    })
  } catch {
    return NextResponse.json({
      content: '(Fetch failed — added as stub)',
      label: getAutoLabel(type, extra),
      loadingMessage: getLoadingMessage(type, extra),
      error: 'Fetch failed',
    })
  }
}

function getAutoLabel(type: string, extra: Record<string, string>): string {
  const labelMap: Record<string, string> = {
    url: extra.url?.replace(/https?:\/\//, '').slice(0, 50) || 'URL',
    search: `${extra.query} — ${extra.period}`,
    youtube: `${extra.channel} · latest ${extra.count}`,
    twitter: `${extra.handle} · ${extra.period}`,
  }
  return labelMap[type] || 'Source'
}

function getLoadingMessage(type: string, extra: Record<string, string>): string {
  const msg = LOADING_MESSAGES[type]
  if (typeof msg === 'function') return msg(extra)
  return (msg as string) || 'Processing…'
}
