const PLATFORM_PROMPTS: Record<string, string> = {
  linkedin: `Write a professional LinkedIn post.
- Hook in the first line (max 12 words, no "I" opener — lead with the insight)
- Story-driven, insight-first structure: Hook → Personal insight or short story → 3 actionable takeaways (use → or • bullets) → Question CTA
- 150-300 words
- Conversational, not corporate — first-person voice
- No hashtags`,

  x: `Write a Twitter/X thread.
- 5-7 tweets total
- Separate each tweet with --- on its own line
- Tweet 1 (hook): punchy, provocative claim or surprising stat — max 270 chars
- Tweets 2-6: one idea per tweet, short punchy sentences — max 270 chars each
- Tweet 7 (CTA): question or call to action — max 270 chars
- No hashtags except optionally 1-2 in the final tweet
- ASCII punctuation only — never use ー or any CJK punctuation`,
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  const data = await res.json()

  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error))
  }

  return data.content?.[0]?.text || ''
}

export async function generateForPlatform(
  sourceContent: string,
  sourceTitle: string,
  platform: string,
  baseVoice?: string
): Promise<string> {
  const platformPrompt = PLATFORM_PROMPTS[platform]
  if (!platformPrompt) throw new Error(`Unsupported platform: ${platform}`)

  const voiceInstruction = baseVoice?.trim()
    ? `\n\nBRAND VOICE — adopt this writer's perspective, vocabulary, and style:\n"${baseVoice.trim()}"`
    : ''

  const systemPrompt = `You are a world-class content strategist who creates platform-native content.${voiceInstruction}

${platformPrompt}

Output ONLY the platform content — no preamble, no labels, no extra explanation.`

  const userPrompt = `Source title: ${sourceTitle}

Source content:
${sourceContent}

Write the ${platform} content now.`

  return callClaude(systemPrompt, userPrompt)
}

export async function generateAllPlatforms(
  sourceContent: string,
  sourceTitle: string,
  platforms: readonly string[],
  baseVoice?: string
): Promise<Record<string, string>> {
  const results = await Promise.all(
    platforms.map(async (platform) => {
      const content = await generateForPlatform(sourceContent, sourceTitle, platform, baseVoice)
      return [platform, content] as [string, string]
    })
  )

  return Object.fromEntries(results)
}
