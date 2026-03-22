const PLATFORM_PROMPTS: Record<string, string> = {
  linkedin: `Write a LinkedIn post that stops the scroll and drives comments.

HOOK (first 2 lines — everything depends on these):
- Line 1: Under 10 words. Bold statement, surprising data point, or vulnerable admission.
  Examples of great hooks:
  - "I said no to a $500K deal."
  - "87% of managers have never received leadership training."
  - "I almost quit my job last month."
  - "Unpopular opinion in tech:"
- Line 2: Create a curiosity gap that forces the "see more" click.
  - "My team thought I was crazy." / "Here's what happened next." / "It's not what you think."

STRUCTURE:
- Hook (2 lines) → Personal story or observation (3-4 short paragraphs) → Key insight or framework (2-3 points) → End with a genuine question (not "Agree?" — ask something specific)
- 800-1300 characters (150-250 words)
- Line break every 1-2 sentences. Never write a wall of text.
- Use "I" perspective. Tell it like a story, not a lecture.

STYLE:
- Vulnerable > polished. Personal stories get 3-5x more reach than informational posts.
- Include one specific number or data point if possible.
- Conversational tone — write like you're texting a smart colleague, not writing a press release.
- No hashtags (they're dead on LinkedIn).
- NEVER include links in the post body (LinkedIn suppresses them). Put links in comments.
- No corporate jargon. No "leveraging synergies." No "thought leadership."
- End with a question that invites long comments, not one-word replies.`,

  x: `Write a Twitter/X thread that gets bookmarked and reposted.

FORMAT:
- 5-8 tweets. Separate each tweet with --- on its own line.
- Each tweet max 270 characters. Each tweet must be valuable STANDALONE — if someone screenshots one tweet, it should still make sense.

HOOK (Tweet 1 — this determines if anyone reads the rest):
Use one of these proven hook patterns:
- Quantified: "I spent 1,000+ hours studying X. Here are 7 lessons:" (specific numbers signal effort)
- Curiosity gap: "Most people get X completely wrong. The truth is counterintuitive:"
- Transformation: "3 years ago I was [state]. Now I [state]. Here's the exact playbook:"
- Contrarian: "Stop doing X. It's killing your Y."
- List tease: "7 tools I use daily that 99% of people don't know about:"
Always end the hook tweet with a colon or "Thread" to signal more is coming.

BODY TWEETS (2-6):
- One insight per tweet. No filler.
- Use short lines with line breaks. One idea per line.
- Alternate between insight tweets and proof/example tweets.
- Use specific numbers, never vague language ("1,247 people" not "thousands").
- Formatting tricks that increase dwell time:
  - "Here's the thing:" on its own line
  - Single-word lines for emphasis: "Simple." / "Wrong."
  - Parenthetical asides feel conversational: "(most people skip this)"
  - Use "you" not "people" — direct address

FINAL TWEET (CTA):
- Ask a question OR request repost: "Which one resonated most?" / "Repost if this was useful."

RULES:
- No external links in any tweet (algorithm penalty). Links go in replies.
- No hashtags except optionally 1 in the last tweet.
- Use arrow, checkmark, or brain emoji as bullet points — max 1-2 emoji per tweet.
- ASCII punctuation only. Never use em dashes. Use regular dashes.
- NEVER be generic. Every line should have a specific insight, number, or example.`,
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
