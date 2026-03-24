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
- NEVER include links in the post body (LinkedIn suppresses them). Put links in comments.
- No corporate jargon. No "leveraging synergies." No "thought leadership."
- End with a question that invites long comments, not one-word replies.

HASHTAGS (at the very end of the post, after a blank line):
- Add exactly 3-5 hashtags. Mix: 2 broad industry tags + 1-2 niche topic tags.
- Broad examples: #AI, #Marketing, #Leadership, #Startups, #ProductManagement
- Niche examples: #ContentStrategy, #B2BSaaS, #CreatorEconomy, #AIAgents
- Never exceed 5. Never use generic tags like #Success or #FollowMe.

MENTIONS:
- If the source article mentions a specific person, company, or creator by name, reference them with @Name in the post body.
- Maximum 3 mentions. Only mention people/companies directly relevant to the content.
- Use the "give credit" pattern: "Inspired by @Person's take on..." or "As @Person put it..."
- This increases engagement because tagged people often respond, which boosts distribution.`,

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
- Use arrow, checkmark, or brain emoji as bullet points — max 1-2 emoji per tweet.
- ASCII punctuation only. Never use em dashes. Use regular dashes.
- NEVER be generic. Every line should have a specific insight, number, or example.

HASHTAGS:
- Use 1-2 hashtags ONLY in the hook tweet (tweet 1), placed inline naturally.
- Example: "I studied 500 #AI startups. Here's what separates winners from losers:"
- Never stack hashtags at the end. Never use more than 2 total across the thread.

MENTIONS:
- If the source article references a specific person or account, mention them with @handle in the relevant tweet.
- Quote tweet format: when referencing someone's take, use "As @handle said:" or ".@handle nailed this:"
- Maximum 2 mentions across the entire thread. Only mention people directly relevant.
- This triggers notifications and if they engage, the algorithm massively boosts reach (reply from original author = 150x weight of a like).`,
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

// --- Analysis: identify repurposable angles from an article ---

export interface ContentAngle {
  id: string
  type: 'key_insight' | 'story' | 'data_point' | 'framework' | 'contrarian_take' | 'how_to' | 'quote'
  title: string
  summary: string
  platforms: string[] // which platforms this angle works best on
  mentions: string[] // people/companies mentioned that could be tagged
}

export interface AnalysisResult {
  article_summary: string
  angles: ContentAngle[]
  total_pieces: number
}

const ANALYSIS_PROMPT = `You are a content strategist who breaks down articles into repurposable content angles.

CRITICAL RULE: You may ONLY identify angles that are explicitly present in the article text. Do NOT invent, infer, or embellish. Every angle must be directly traceable to specific sentences or paragraphs in the source article. If the article only has 2 strong angles, return 2 — do not pad with made-up angles.

Analyze the article and identify distinct pieces of content that could be turned into standalone social media posts.

Types of angles to look for:
- key_insight: A core takeaway or lesson explicitly stated in the article (works on LinkedIn + X)
- story: A personal anecdote or narrative arc the author actually tells (works best on LinkedIn)
- data_point: A specific statistic, number, or metric mentioned in the article (works on X + LinkedIn)
- framework: A mental model, system, or step-by-step process the author describes (works on X threads)
- contrarian_take: An opinion the author explicitly argues against conventional wisdom (works on X + LinkedIn)
- how_to: Actionable advice or steps the author actually provides (works on X threads)
- quote: A memorable sentence or phrase the author actually wrote (works as standalone X tweet)

For each angle, specify which platforms it works best on: "linkedin", "x", or both.

In each summary, reference the specific fact, quote, or detail from the article that this angle is based on.

Respond in this exact JSON format (no markdown, no code fences):
{
  "article_summary": "1-2 sentence summary of the article",
  "angles": [
    {
      "id": "1",
      "type": "key_insight",
      "title": "Short title for this angle (max 10 words)",
      "summary": "2-3 sentences describing what this content piece would cover. Must reference specific details from the article.",
      "platforms": ["linkedin", "x"],
      "mentions": ["@PersonName", "@CompanyName"]
    }
  ]
}

For each angle, also list any specific people, companies, or accounts mentioned in the article that could be @tagged in the post. If no specific names are mentioned, use an empty array.

Only return angles that are DIRECTLY supported by the article text. Quality over quantity.`

export async function analyzeArticle(
  sourceContent: string,
  sourceTitle: string,
): Promise<AnalysisResult> {
  const result = await callClaude(
    ANALYSIS_PROMPT,
    `Article title: ${sourceTitle}\n\nArticle content:\n${sourceContent}`,
  )

  try {
    // Clean up potential markdown code fences
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned) as AnalysisResult
    parsed.total_pieces = parsed.angles.reduce((sum, a) => sum + a.platforms.length, 0)
    return parsed
  } catch {
    // Fallback if Claude doesn't return valid JSON
    return {
      article_summary: sourceTitle,
      angles: [
        { id: '1', type: 'key_insight', title: sourceTitle, summary: 'Full article repurpose', platforms: ['linkedin', 'x'], mentions: [] },
      ],
      total_pieces: 2,
    }
  }
}

export async function generateForAngle(
  sourceContent: string,
  sourceTitle: string,
  angle: ContentAngle,
  platform: string,
  baseVoice?: string,
): Promise<string> {
  const platformPrompt = PLATFORM_PROMPTS[platform]
  if (!platformPrompt) throw new Error(`Unsupported platform: ${platform}`)

  const voiceInstruction = baseVoice?.trim()
    ? `\n\nBRAND VOICE — adopt this writer's perspective, vocabulary, and style:\n"${baseVoice.trim()}"`
    : ''

  const systemPrompt = `You are a world-class content strategist who creates platform-native content.${voiceInstruction}

GROUNDING RULES (non-negotiable):
- Every claim, number, statistic, and insight MUST come directly from the source article below.
- Do NOT invent statistics, quotes, or facts that are not in the source.
- Do NOT add examples, case studies, or anecdotes that the author did not include.
- Do NOT attribute opinions or experiences to the author that they did not express.
- If the source says "many companies" do NOT change it to "73% of companies" — keep it vague if the source is vague.
- You may rephrase and restructure for the platform format, but the underlying facts must be identical to the source.
- If a number appears in the source, use the EXACT number. Do not round, estimate, or embellish.

${platformPrompt}

Output ONLY the platform content — no preamble, no labels, no extra explanation.`

  const userPrompt = `Source article title: ${sourceTitle}

SPECIFIC ANGLE TO FOCUS ON:
Type: ${angle.type}
Focus: ${angle.title}
Brief: ${angle.summary}

Source article — ALL facts, numbers, and insights must come from this text:
${sourceContent}

Write the ${platform} content focused on this angle. Use ONLY information from the source article above.`

  return callClaude(systemPrompt, userPrompt)
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

GROUNDING RULES (non-negotiable):
- Every claim, number, statistic, and insight MUST come directly from the source article below.
- Do NOT invent statistics, quotes, or facts that are not in the source.
- Do NOT add examples, case studies, or anecdotes that the author did not include.
- Do NOT attribute opinions or experiences to the author that they did not express.
- If the source says "many companies" do NOT change it to "73% of companies".
- You may rephrase and restructure for the platform format, but the facts must be identical to the source.

${platformPrompt}

Output ONLY the platform content — no preamble, no labels, no extra explanation.`

  const userPrompt = `Source title: ${sourceTitle}

Source article — ALL facts, numbers, and insights must come from this text:
${sourceContent}

Write the ${platform} content now. Use ONLY information from the source article above.`

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

// --- Viral score: AI analyzes the actual generated content ---

export interface ViralScore {
  overall: number          // 0-100
  hook_strength: number    // 0-100
  reply_potential: number  // 0-100
  save_potential: number   // 0-100
  share_potential: number  // 0-100
  verdict: string          // one-line summary
  improvement: string      // one specific suggestion to improve
}

const VIRAL_SCORE_PROMPT = `You are a social media content analyst. Score this post on how likely it is to go viral on the specified platform.

SCORING CRITERIA (each 0-100):

hook_strength: How strong is the opening? Does it stop the scroll?
- 90-100: Provocative claim, surprising stat, or emotional hook that demands attention
- 60-80: Decent opener but could be sharper
- 0-50: Generic, boring, or buried lede

reply_potential: Will people REPLY to this? (Replies are the #1 viral signal on both LinkedIn and X)
- 90-100: Contains a debatable opinion, asks a thought-provoking question, or challenges a common belief
- 60-80: Might get some replies but doesn't strongly invite conversation
- 0-50: Informational only, nothing to respond to

save_potential: Will people BOOKMARK/SAVE this? (Bookmarks are 20x a like on X, high signal on LinkedIn)
- 90-100: Reference-worthy — frameworks, checklists, data, tools, step-by-step guides
- 60-80: Somewhat useful but not reference material
- 0-50: Entertaining but not saveable

share_potential: Will people REPOST/SHARE this? (People share to look smart or to validate their own beliefs)
- 90-100: Makes the sharer look insightful — surprising data, novel framework, or "I've been saying this!"
- 60-80: Good content but not obviously share-worthy
- 0-50: Too personal or niche to share

overall: Weighted average considering the platform's algorithm:
- LinkedIn: dwell_time(30%) + reply_potential(30%) + save_potential(20%) + share_potential(20%)
- X: reply_potential(35%) + save_potential(30%) + hook_strength(20%) + share_potential(15%)

Also provide:
- verdict: One pithy sentence summarizing the post's viral potential (e.g., "Strong hook but nothing to debate — add a question" or "This will get bookmarked all day")
- improvement: One SPECIFIC change to make this score higher (not generic advice — reference the actual content)

Respond in this exact JSON format (no markdown, no code fences):
{
  "overall": 72,
  "hook_strength": 85,
  "reply_potential": 60,
  "save_potential": 80,
  "share_potential": 65,
  "verdict": "Great hook and save-worthy framework, but needs a debatable angle to drive replies",
  "improvement": "End with a provocative question like 'Is this the end of [specific thing]?' to invite debate"
}`

export async function scoreVirality(
  content: string,
  platform: string,
): Promise<ViralScore> {
  const result = await callClaude(
    VIRAL_SCORE_PROMPT,
    `Platform: ${platform === 'x' ? 'X (Twitter)' : 'LinkedIn'}\n\nPost content:\n${content}`,
  )

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as ViralScore
  } catch {
    return {
      overall: 50,
      hook_strength: 50,
      reply_potential: 50,
      save_potential: 50,
      share_potential: 50,
      verdict: 'Could not analyze',
      improvement: 'Try regenerating this content',
    }
  }
}
