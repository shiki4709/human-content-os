import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { platform, content, instruction, isThread } = body as {
    platform: string
    content: string
    instruction: string
    isThread?: boolean
  }

  if (!content || !instruction) {
    return NextResponse.json({ error: 'Content and instruction required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  const prompt = `Refine this ${platform} post.

Current:
${content}

Instruction: "${instruction}"

Return ONLY the refined post${isThread ? ' in TWEET_1: text | TWEET_2: text format' : ''}.`

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()

    if (data.error) {
      return NextResponse.json({
        error: data.error.message || JSON.stringify(data.error),
      }, { status: 500 })
    }

    const refined = data.content?.[0]?.text?.trim() || content
    return NextResponse.json({ content: refined })
  } catch {
    return NextResponse.json({ error: 'Refinement failed' }, { status: 500 })
  }
}
