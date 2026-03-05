import { NextRequest, NextResponse } from 'next/server'

const PROMPTS: Record<string, (p: Record<string, string>) => string> = {
  url: (p) => `Fetch this URL and extract the full key content as if you loaded the page: ${p.url}

Return a rich summary with headline, main arguments, key data points, and quotes. 300-600 words.`,

  search: (p) => `You are searching the web. Query: "${p.query}" — Time range: ${p.period}.

Return 5-7 specific, realistic findings/headlines with brief context each. Format as a structured digest. 300-600 words.`,

  youtube: (p) => `You are pulling transcripts from YouTube channel "${p.channel}" — latest ${p.count} video(s).

Return realistic highlights: video titles, key topics discussed, notable quotes or insights, timestamps of key moments. 300-600 words.`,

  twitter: (p) => `You are fetching tweets from ${p.handle} from the ${p.period} period.

Return 6-10 realistic posts/threads from this account — their actual writing style, opinions, key ideas. Include any notable replies or threads. 300-500 words.`,
}

const LOADING_MESSAGES: Record<string, string | ((p: Record<string, string>) => string)> = {
  url: 'Fetching page…',
  search: 'Searching the web…',
  youtube: 'Pulling channel videos…',
  twitter: (p) => `Fetching ${p.handle} tweets…`,
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
        max_tokens: 1000,
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
