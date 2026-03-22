# Design: Human Content OS — Agentic Repurposing Agent

**Date:** 2026-03-20
**Status:** DRAFT

## Problem Statement

Human Content OS is a content repurposing tool with a web dashboard that the founder built but doesn't use. The dashboard requires manual effort: open the app, add sources, configure, generate, review, publish. The founder actually wants an agent that automatically distributes content across platforms — push-based, not pull-based.

The existing codebase has solid content generation logic (Claude prompts, platform-specific formatting, OAuth integrations) but the wrong interaction model.

## Decision: Standalone Agent, Not Pingi Module

Human was considered for merging into Pingi (the founder's X engagement agent) but remains standalone because:
- Different job: Pingi = real-time engagement (conversations, replies). Human = content distribution (repurposing across platforms).
- Different cadence: Pingi is all-day ambient engagement. Human triggers on publish events (1-2x/week).
- The cross-border localization angle (English → Rednote Chinese, note.com Japanese) is Human's unique differentiator and would get buried inside Pingi.

## Product Identity

**One-liner:** Post once, reach everywhere — Human auto-repurposes your content across platforms and languages.

**Wedge:** Agentic, Telegram-first content distribution. No dashboard. Push-based approval.

**Differentiators vs. competitors (Repurpose.io, Castmagic, Munch):**
1. Agentic — pushes to Telegram, not a dashboard you visit
2. Cross-border localization (P1) — English → Chinese (Rednote), Japanese (note.com), culturally adapted
3. Platform-native formatting — not just pasting text, but format-specific output (X threads, Rednote carousels, LinkedIn long-form)

## Core Flow

1. User publishes content somewhere (Substack article, initially)
2. Human detects it (RSS poll every 15 min, or manual `/repurpose [url]` command in Telegram)
3. Content engine (Claude) generates platform-native versions for each target platform, using the user's brand voice
4. Human pushes generated content to Telegram with Send / Edit / Skip buttons per platform
5. User reviews and approves with one tap — Human publishes via platform APIs

## Source & Target Matrix

### P0 (Launch)

**Source:**
- Substack — RSS feed polling every 15 minutes

**Targets:**
- LinkedIn — professional long-form post, English, published via LinkedIn API v2
- X/Twitter — thread format (4-8 tweets, 280 char each, split on `---`), published via X API v2

**Manual trigger:**
- Telegram `/repurpose [url]` command — paste any Substack URL (P0) or any URL (P1), Human fetches content and generates for all enabled targets

### P1 (After P0 validated)

**Additional targets:**
- Rednote 小红书 — Chinese, culturally adapted (not translated), carousel images (cover + 2-3 content slides + CTA). No API; copy text to clipboard + download carousel images.
- note.com — Japanese, culturally adapted long-form. Publish via note.com API if available, otherwise copy to clipboard.

### P2 (Future)

**Additional sources:**
- X/Twitter — monitor user's own timeline for new tweets/threads
- LinkedIn — monitor user's own posts
- YouTube — RSS feed for new videos

**Additional targets:**
- Substack — long-form newsletter draft

## Architecture

```
┌─────────────────────────────────────────────┐
│              Human Agent (Node.js)           │
├─────────────────────────────────────────────┤
│  Source Watcher                              │
│  ├── SubstackWatcher (RSS poll, 15 min)     │
│  ├── Dedup (track processed post GUIDs)     │
│  └── ManualInput (Telegram /repurpose cmd)  │
├─────────────────────────────────────────────┤
│  Content Engine                              │
│  ├── Claude API (claude-sonnet-4-5)          │
│  ├── Platform prompts (LinkedIn, X, etc.)   │
│  ├── Brand voice injection                  │
│  └── Localization layer (P1: CN, JP)        │
├─────────────────────────────────────────────┤
│  Publisher                                   │
│  ├── LinkedInPublisher (API v2 post)        │
│  ├── XPublisher (API v2 thread)             │
│  ├── RednotePublisher (copy + images) [P1]  │
│  └── NoteComPublisher (API or copy) [P1]    │
├─────────────────────────────────────────────┤
│  Telegram Bot                                │
│  ├── /start — onboarding flow               │
│  ├── /repurpose [url] — manual trigger      │
│  ├── /voice — view/update brand voice       │
│  ├── Push content cards with Send/Edit/Skip │
│  └── Edit flow (user types instruction)     │
├─────────────────────────────────────────────┤
│  Data (Supabase)                             │
│  ├── users + auth                           │
│  ├── sources (detected content)             │
│  ├── generated_content (per platform)       │
│  ├── publish_log (status tracking)          │
│  └── platform_connections (OAuth tokens)    │
└─────────────────────────────────────────────┘
```

### Telegram Bot Interface

The Telegram bot is the only user-facing interface. No web dashboard for content operations.

**Onboarding (`/start`):**
1. Welcome message explaining Human
2. Provide Substack RSS URL (e.g., `https://yourname.substack.com/feed`)
3. Set brand voice — user describes their writing style in 1-2 sentences, optionally pastes 2-3 example posts
4. Connect LinkedIn via OAuth (bot sends auth URL, user completes in browser, callback confirms)
5. Connect X via OAuth (same flow)
6. Confirmation: "You're set! I'll watch your Substack and repurpose new posts to LinkedIn and X."

**OAuth flow in Telegram context:**
Bot generates an OAuth URL with a `state` param encoding the Telegram `chat_id` + a short-lived session token. User opens URL in browser, completes OAuth on LinkedIn/X. The callback endpoint (on the Fastify server, e.g., `/auth/callback/linkedin`) exchanges the auth code for tokens, stores them in `platform_connections` linked to the user via the `state` param, and sends a Telegram confirmation message: "LinkedIn connected!"

**Telegram callback data format:**
Inline keyboard buttons encode action + content ID: `send:{content_id}`, `edit:{content_id}`, `skip:{content_id}`, `review_all:{source_id}`, `send_all:{source_id}`. The callback handler parses the prefix to determine action, looks up the `generated_content` row by ID, and executes.

**Content push flow:**
```
Human Bot: "📝 New Substack post detected:
'Why AI Agents Are the Future'

I've created 2 versions:
🔵 LinkedIn — Professional post (287 words)
⬛ X — Thread (5 tweets)

[Review All] [Send All] [Skip]"
```

User taps "Review All":
```
Human Bot: "🔵 LinkedIn version:

The future of software isn't apps you open — it's
agents that come to you...

[Send] [Edit] [Skip]"
```

If Edit:
```
Human Bot: "How should I adjust it?"
User: "Make it more personal, add a specific example"
Human Bot: "Here's the updated version:
[revised content]

[Send] [Edit] [Skip]"
```

After LinkedIn is handled, show X version in same flow.

**Edit flow limits:** Unlimited edit rounds. If the user doesn't respond for 4 hours, the edit session expires and the content status reverts to `pending_review` — the user can tap "Review All" again later.

**Error handling:**
- OAuth token expired: "Your LinkedIn connection expired. [Reconnect]"
- API publish failure: "Couldn't post to X — [Retry] or [Copy to clipboard]"
- RSS fetch failure: silent retry on next poll cycle; alert user if 3+ consecutive failures
- Content generation failure (Claude API): retry once after 5 seconds; if still failing, notify user: "Couldn't generate content for '{title}' — [Retry]"

### Content Engine

**Platform prompts (reuse from existing prototype.html):**

- **LinkedIn:** Professional, insight-driven post. Hook in first line. No hashtags. 150-300 words. First-person voice.
- **X/Twitter:** Thread format. Start with hook tweet. Each tweet max 280 chars. Separate tweets with `---`. 4-8 tweets. Punchy, conversational.
- **Rednote (P1):** 小红书笔记. 中文. 生活化语气. emoji适量. Cover hook + 2-3 content points + CTA. 200-400字. 文化本土化，不要直译.
- **note.com (P1):** Japanese long-form. Cultural adaptation for Japanese audience. Formal but approachable tone. Include section headers.

**Brand voice:** Injected into every generation prompt as a system-level instruction. Stored as a text description in the user profile. Set during onboarding, editable via `/voice` command. If the user pastes example posts instead of a description, Claude distills them into a 1-2 sentence voice description which is then stored.

**`/voice` command flow:**
```
User: /voice
Bot: "Your current brand voice:
'Conversational, direct, uses analogies from engineering to explain business concepts.'

[Update] [Keep]"

User taps Update:
Bot: "Send me your new brand voice description (1-2 sentences), or paste 2-3 example posts and I'll figure out your voice."
User: [pastes examples or writes description]
Bot: "Brand voice updated! All future content will use this style."
```

**Rednote cultural adaptation (P1) — concrete examples:**
- Direct translation: "This AI tool saves you 10 hours per week" → BAD
- Cultural adaptation: "用了这个AI工具之后，我终于不用加班了 😭" (After using this AI tool, I finally don't have to work overtime) → GOOD
- Use Xiaohongshu-native tone: casual, emoji-rich, personal story framing, trending hashtag style
- Reference local context: use Chinese tech examples (WeChat, Douyin) instead of Western equivalents
- Format: list-style with emoji bullets, not Western paragraph format

### What Gets Reused From Existing Codebase

| Component | Location | Reuse Strategy |
|-----------|----------|---------------|
| Claude prompt templates | `prototype.html` PROMPTS object | Port directly into content engine |
| LinkedIn OAuth + publish | `web/src/app/api/publish/`, `web/src/lib/platforms/linkedin.ts` | Extract and adapt for bot context |
| X OAuth + thread publish | `web/src/lib/platforms/x.ts` | Extract and adapt |
| Supabase schema | `supabase-setup.sql` | Reuse tables: sources, generated_content, publish_log, platform_connections. **Migration needed:** `generated_content.status` expands from `draft/published` to the full lifecycle states defined above. |
| Rednote canvas carousel | `prototype.html` canvas code | Port to server-side image generation (P1) |
| Brand voice system | Configure tab logic | Simplify for Telegram onboarding |

### What Gets Built New

| Component | Description |
|-----------|-------------|
| Telegram bot | Fastify server + fetch-based Telegram Bot API client (webhook mode for prod, long-polling for dev). Conversation state stored in Supabase `chat_sessions` table. Pattern reference: `pingi-ai/bot/src/index.ts` and `pingi-ai/bot/src/telegram.ts` |
| Substack RSS watcher | Poll RSS feed every 15 min, detect new posts, extract full content |
| Push + approval flow | Telegram message formatting with inline keyboards |
| Edit flow | Conversational edit loop: track `editing` state per chat in Supabase, accept free-text instruction, call Claude to revise, re-show buttons. Reference: `pingi-ai/bot/src/handlers.ts` edit flow |
| Onboarding via Telegram | Step-by-step setup: RSS URL, brand voice, OAuth connections |

### Web App Changes

The existing Next.js web app becomes a landing page + auth/billing only:
- Keep: landing page, Supabase auth, Stripe billing (if added)
- Remove (or mothball): Sources tab, Configure tab, Generate tab, Publish tab
- Add: Telegram bot connect button (link to bot)

## What the Existing Dashboard Becomes

The current 4-tab dashboard (Sources → Configure → Generate → Publish) is replaced by the Telegram bot. The web app's role shrinks to:
1. Marketing landing page
2. Auth (signup/login)
3. Billing (future)
4. "Connect to Telegram" CTA that links to the bot

No content operations happen in the web UI.

## Multi-Tenancy

P0 is single-user (founder only). The Substack RSS watcher runs as a single cron job polling one feed. If the product gains traction and needs multi-user support, the watcher will need to iterate over all users' feeds in a shared poll loop (or use a job queue like BullMQ). This is a P2 concern — don't over-engineer for it now.

## Content Lifecycle States

```
generated_content.status:
  generating    → Claude is producing content
  pending_review → pushed to Telegram, waiting for user action
  editing       → user tapped Edit, awaiting revision instruction
  approved      → user tapped Send, ready to publish
  published     → successfully posted to platform
  skipped       → user tapped Skip
  (no expired state — on 4h timeout, status reverts to pending_review)

publish_log.status:
  published     → successfully posted via API
  draft         → copied to clipboard (Rednote, or fallback)
  failed        → API error, user notified with Retry option
```

## RSS Deduplication

The Substack RSS watcher tracks processed posts by storing each post's RSS `<guid>` (or `<link>` as fallback) in the `sources` table. On each poll:
1. Fetch RSS feed
2. For each entry, check if `guid` exists in `sources` for this user
3. Skip already-processed entries
4. For new entries, create a `sources` row and trigger content generation

## Substack RSS Content Completeness

**Design decision (not an open question):** Substack RSS feeds include full article HTML in the `<content:encoded>` field. This is sufficient for content generation. However, as a fallback, if `<content:encoded>` is missing or truncated (<500 chars), Human will fetch the full Substack page via HTTP and extract content using HTML parsing (cheerio + Readability). This fallback is part of P0 scope. **Note:** Paywalled Substack posts will be truncated in both RSS and HTTP fetch. P0 assumes the user's content is free-tier. Handling paywalled content (e.g., via Substack API with auth) is a P1 concern.

## P0 Success Criteria

- Founder (you) actively uses it to repurpose Substack → LinkedIn + X for 2+ weeks
- Content quality: generated posts require <2 edits on average before sending
- Latency: new Substack post → Telegram notification within 25 minutes on average (15 min worst-case poll delay + ~5 min generation + push)
- Reliability: 0 missed posts over 2 weeks of monitoring

## P1 Scope (After P0 Validated)

- Rednote target: Chinese localization + server-side carousel image generation
- note.com target: Japanese localization + publish/copy
- Expand `/repurpose` to accept any URL (not just Substack) — fetch and parse arbitrary web content
- Analytics: track which repurposed posts get the most engagement per platform

## Open Questions

1. **note.com API:** Does note.com have a public API for posting? If not, what's the publish mechanism — copy to clipboard only?
2. **Rednote carousel server-side (P1 spike):** The existing canvas code runs in the browser. Porting to server-side requires either Puppeteer (full fidelity, heavier dependency) or Sharp/SVG (lighter, but needs reimplementation of text layout). Recommend a P1 spike to evaluate both approaches before committing. This is non-trivial — budget 2-3 days for the spike.
3. **Rate limiting:** How often can you post to LinkedIn/X via API before hitting limits? Need to respect platform norms (not spammy).
