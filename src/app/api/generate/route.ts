import { NextRequest, NextResponse } from 'next/server'

const PPROMPTS: Record<string, string> = {
  linkedin: '[LINKEDIN]\nProfessional post 150-300 words. Hook first line. Line breaks. 3-5 hashtags. CTA end.[/LINKEDIN]',
  x: '[X]\nThread of 5-8 tweets. MUST use format: TWEET_1: text | TWEET_2: text | etc. Each tweet ≤280 chars. First tweet = hook.[/X]',
  substack: '[SUBSTACK]\nNewsletter section 250-400 words. Personal, conversational, smart. No hashtags. Warm tone.[/SUBSTACK]',
  rednote: '[REDNOTE]\nWrite ENTIRELY in Simplified Chinese. Native 小红书 style — NOT translated. 200-400 chars. 干货/分享/种草 vibe. Heavy emojis 🌟✨💡🔥. Chinese hashtags end.[/REDNOTE]',
  notejp: '[NOTEJP]\nWrite ENTIRELY in Japanese. Native note.com style — NOT translated. 300-500 chars. Reflective, warm, slightly formal. Subtle emojis. Japanese hashtags.[/NOTEJP]',
  instagram: '[INSTAGRAM]\nCaption 80-150 words. Visual-forward, aspirational, lifestyle tone. Strong opening. 10-15 hashtags after line break.[/INSTAGRAM]',
}

const TAG_MAP: Record<string, string> = {
  linkedin: 'LINKEDIN',
  x: 'X',
  substack: 'SUBSTACK',
  rednote: 'REDNOTE',
  notejp: 'NOTEJP',
  instagram: 'INSTAGRAM',
}

const TONE_MAP: Record<string, string> = {
  'Thought leader': 'authoritative thought leader sharing deep insights clearly',
  'Casual founder': 'casual founder — real, direct, no fluff',
  'Storyteller': 'engaging storyteller using narrative and personal anecdotes',
  'Professional': 'polished professional — credible and concise',
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sources, platforms, brandVoice, tone } = body as {
    sources: { label: string; content: string }[]
    platforms: string[]
    brandVoice: string
    tone: string
  }

  if (!sources?.length) {
    return NextResponse.json({ error: 'No sources provided' }, { status: 400 })
  }
  if (!platforms?.length) {
    return NextResponse.json({ error: 'No platforms selected' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  const brand = brandVoice?.trim() || 'a founder sharing insights'
  const toneDesc = TONE_MAP[tone] || tone || 'authoritative thought leader sharing deep insights clearly'

  const combinedSrc = sources
    .map((s, i) => `SOURCE ${i + 1} [${s.label}]:\n${s.content}`)
    .join('\n\n---\n\n')

  const platInstr = platforms.map(p => PPROMPTS[p]).filter(Boolean).join('\n\n')

  const systemPrompt = `You are a world-class content strategist who creates platform-native content.

BRAND VOICE (use this verbatim as the writer's identity — adopt their perspective, vocabulary, and style):
"${brand}"

TONE: ${tone}
Apply this tone consistently: write as ${toneDesc}. This tone should shape word choice, sentence structure, and overall energy of every piece of content.

Synthesize ${sources.length} source(s) into ONE unified core insight, then create content for each platform.

CRITICAL RULES:
- Synthesize ALL sources, not just one
- The brand voice above MUST be reflected in every piece of content — use the writer's specific language, metaphors, and framing
- Chinese (Rednote): NATIVE Simplified Chinese, culturally adapted — never translate
- Japanese (Note.jp): NATIVE Japanese, culturally adapted — never translate
- X/Twitter MUST use format: TWEET_1: text | TWEET_2: text | TWEET_3: text (etc)
- Each platform gets completely different treatment

FORMAT — use EXACTLY these XML tags:
[CORE_INSIGHT]one unified insight sentence in English[/CORE_INSIGHT]
Then platform blocks as specified.`

  const userPrompt = `Create content for: ${platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}\n\n${combinedSrc}\n\nINSTRUCTIONS:\n${platInstr}`

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
        max_tokens: 5000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await res.json()

    if (data.error) {
      console.error('Anthropic API error:', data.error)
      return NextResponse.json({
        error: data.error.message || JSON.stringify(data.error),
      }, { status: 500 })
    }

    const txt = data.content?.[0]?.text || ''

    // Parse core insight
    const insightMatch = txt.match(/\[CORE_INSIGHT\]([\s\S]*?)\[\/CORE_INSIGHT\]/i)
    const coreInsight = insightMatch ? insightMatch[1].trim() : ''

    // Parse platform content
    const results: Record<string, string> = {}
    for (const pk of platforms) {
      const tag = TAG_MAP[pk]
      if (!tag) continue
      const m = txt.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i'))
      results[pk] = m ? m[1].trim() : '(Not generated — try again)'
    }

    return NextResponse.json({ coreInsight, results })
  } catch {
    return NextResponse.json({ error: 'Generation failed — check connection' }, { status: 500 })
  }
}
