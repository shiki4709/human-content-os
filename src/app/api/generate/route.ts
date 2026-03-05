import { NextRequest, NextResponse } from 'next/server'

const PPROMPTS: Record<string, string> = {
  linkedin: `[LINKEDIN]
Hook: bold single-sentence opener (max 12 words) before the "see more" cutoff. Use curiosity gap, contrarian take, or specific number. Never start with "I" — start with the insight.
Body: 1-2 sentence paragraphs with white space between each. No walls of text.
Structure: Hook → Personal insight or short story → 3 actionable takeaways (use → or • bullets, not dashes) → Question CTA asking the reader to engage.
150-300 words, conversational not corporate, first-person voice.
Max 3 relevant hashtags at the very end.
[/LINKEDIN]`,

  x: `[X]
MUST use format: TWEET_1: text | TWEET_2: text | etc.
Tweet 1 (hook): bold claim or surprising stat + "Thread 🧵" — max 240 chars.
Tweets 2-6: one idea per tweet, short punchy sentences, line breaks not paragraphs. Each tweet max 280 chars.
Tweet 7 (CTA): question to followers or call to action.
5-7 tweets total — sweet spot for completion rate.
Use 1-2 hashtags max in final tweet only.
NEVER use ー or any Japanese/CJK punctuation. English ASCII punctuation only.
[/X]`,

  substack: `[SUBSTACK]
Opening: one punchy paragraph that earns the scroll — no throat-clearing.
3-4 sections with bold subheadings (## Markdown style).
Conversational but substantive, 400-600 words. Personal voice.
End with "What do you think?" or a reflective question that invites reply.
No hashtags. No promotional CTAs.
[/SUBSTACK]`,

  rednote: `[REDNOTE]
Write ENTIRELY in native Simplified Chinese. 绝对不能翻译，要原生中文表达。
开头: emoji + hook sentence that stops the scroll (pain point or bold claim)
中间: 3 numbered points 第一/第二/第三, each with emoji, max 2 lines each
结尾: 关注+点赞+收藏 CTA
200-350字, 适量emoji, 亲切口语化
绝对不能用 ー 或任何日文标点。只用中文标点。
hashtags: 3-5 relevant Chinese tags at end like #干货分享 #职场成长
[/REDNOTE]`,

  notejp: `[NOTEJP]
Write ENTIRELY in Japanese. Native note.com style — NOT translated.
300-500 chars. Reflective, warm, slightly formal. Subtle emojis. Japanese hashtags.
[/NOTEJP]`,

  instagram: `[INSTAGRAM]
Caption 80-150 words. Visual-forward, aspirational, lifestyle tone. Strong opening. 10-15 hashtags after line break.
[/INSTAGRAM]`,
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
