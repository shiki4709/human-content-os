# Design: Human Content OS — Auto-Repurposing Dashboard

**Date:** 2026-03-20
**Status:** DRAFT

## Problem Statement

Human Content OS has a web dashboard with a 4-tab manual workflow (Sources → Configure → Generate → Publish). The founder built it but doesn't use it because each step requires manual effort. The content generation logic (Claude prompts, platform formatting, OAuth) is solid — the problem is that the workflow is too manual.

The fix: make the dashboard automatic. Human watches your Substack, auto-generates platform-native content, and presents it in the dashboard ready to review and publish. No manual sourcing, no manual generation. You open the dashboard and your repurposed content is already there.

## Decision: Standalone Product, Not Pingi Module

Human stays separate from Pingi (the founder's X engagement agent) because:
- Different job: Pingi = real-time engagement (conversations, replies). Human = content distribution (repurposing across platforms).
- Different cadence: Pingi is all-day ambient engagement. Human triggers on publish events (1-2x/week).
- The cross-border localization angle (English → Rednote Chinese, note.com Japanese) is Human's unique differentiator.

## Product Identity

**One-liner:** Post once, reach everywhere — Human auto-repurposes your content across platforms and languages.

**Differentiators vs. competitors (Repurpose.io, Castmagic, Munch):**
1. Auto-detect + auto-generate — no manual "add source" or "click generate" steps
2. Cross-border localization (P1) — English → Chinese (Rednote), Japanese (note.com), culturally adapted, not just translated
3. Platform-native formatting — X threads, Rednote carousels, LinkedIn long-form, note.com articles

## Core Flow

```
1. You publish a Substack article
2. Human detects it via RSS (~15 min)
3. Human auto-generates LinkedIn post + X thread using your brand voice
4. You open the Human dashboard on your laptop
5. Your repurposed content is already there, ready to review
6. Edit inline if needed → one-click publish per platform
```

**Key difference from current dashboard:** No Sources tab, no Configure tab, no Generate button. Content appears automatically. The dashboard is a review + publish screen.

## Source & Target Matrix

### P0 (Launch)

**Source:**
- Substack — RSS feed polling every 15 minutes, auto-detected

**Targets:**
- LinkedIn — professional long-form post, English, published via LinkedIn API v2
- X/Twitter — thread format (4-8 tweets, 280 char each, split on `---`), published via X API v2

**Manual trigger:**
- "Repurpose URL" input on dashboard — paste any Substack URL (P0) or any URL (P1), Human fetches and generates

### P1 (After P0 validated)

**Additional targets:**
- Rednote 小红书 — Chinese, culturally adapted, carousel images (cover + 2-3 content slides + CTA). No API; copy text + download images.
- note.com — Japanese, culturally adapted long-form. Publish via note.com API if available, otherwise copy.

### P2 (Future)

**Additional sources:**
- X/Twitter — monitor user's own timeline for new tweets/threads
- LinkedIn — monitor user's own posts
- YouTube — RSS feed for new videos

**Additional targets:**
- Substack — long-form newsletter draft

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Human Content OS                    │
├─────────────────────────────────────────────────┤
│  Background Worker (Node.js)                     │
│  ├── SubstackWatcher (RSS poll, 15 min)         │
│  ├── Dedup (track processed post GUIDs)         │
│  └── Auto-generate on new post detected         │
├─────────────────────────────────────────────────┤
│  Content Engine                                  │
│  ├── Claude API (claude-sonnet-4-5)             │
│  ├── Platform prompts (LinkedIn, X, etc.)       │
│  ├── Brand voice injection                      │
│  └── Localization layer (P1: CN, JP)            │
├─────────────────────────────────────────────────┤
│  Publisher                                       │
│  ├── LinkedInPublisher (API v2 post)            │
│  ├── XPublisher (API v2 thread)                 │
│  ├── RednotePublisher (copy + images) [P1]      │
│  └── NoteComPublisher (API or copy) [P1]        │
├─────────────────────────────────────────────────┤
│  Next.js Web App (existing, simplified)          │
│  ├── Landing page                               │
│  ├── Auth (Supabase)                            │
│  ├── Onboarding (RSS URL + brand voice + OAuth) │
│  ├── Review dashboard (auto-populated content)  │
│  └── Publish controls (one-click per platform)  │
├─────────────────────────────────────────────────┤
│  Data (Supabase)                                 │
│  ├── users + auth                               │
│  ├── sources (detected content + RSS GUIDs)     │
│  ├── generated_content (per platform)           │
│  ├── publish_log (status tracking)              │
│  └── platform_connections (OAuth tokens)        │
└─────────────────────────────────────────────────┘
```

### Background Worker

A separate Node.js process (or Next.js cron/API route triggered by Vercel Cron) that:
1. Polls the user's Substack RSS feed every 15 minutes
2. Deduplicates by checking `sources` table for existing GUIDs
3. On new post: fetches full content, calls Claude to generate per-platform versions, stores in `generated_content` with status `pending_review`

**Implementation options for the worker:**
- **Vercel Cron + API route:** Add a `/api/cron/poll-rss` endpoint, trigger via Vercel Cron every 15 min. Simplest, stays within existing Next.js infra. Limited to Vercel's cron constraints (max 60s execution on Hobby plan).
- **Separate Node.js process:** Standalone script with `setInterval`. Deploy on Railway or Fly.io. More flexible, can run longer jobs. Same pattern as Pingi's bot server.

**Recommendation:** Start with Vercel Cron but split into two steps:
1. **Cron job (`/api/cron/poll-rss`):** Polls RSS, deduplicates, writes new `sources` rows with status `detected`. Fast — completes in <5s.
2. **Generation job (`/api/cron/generate`):** Triggered by cron immediately after poll (or by DB insert webhook). Reads unprocessed sources, calls Claude in **parallel** for both LinkedIn and X (Promise.all), writes `generated_content` rows. This avoids the 60s constraint since each platform generation runs concurrently (~15-20s total instead of 30-40s sequential).

If Vercel's 60s limit is still tight, migrate the generation job to a separate worker on Railway/Fly.io.

### Simplified Dashboard

The existing 4-tab dashboard (Sources → Configure → Generate → Publish) becomes a **single-screen review + publish dashboard:**

```
┌──────────────────────────────────────────────────────┐
│  Human Content OS                    [Settings] [+URL]│
├──────────────────────────────────────────────────────┤
│                                                       │
│  📝 "Why AI Agents Are the Future"                   │
│  Detected from Substack · 2 hours ago                │
│                                                       │
│  ┌─────────────────────┐  ┌─────────────────────┐   │
│  │ 🔵 LinkedIn          │  │ ⬛ X Thread          │   │
│  │                      │  │                      │   │
│  │ The future of soft-  │  │ 1/5: Every app you   │   │
│  │ ware isn't apps you  │  │ use today will be    │   │
│  │ open — it's agents   │  │ replaced by an       │   │
│  │ that come to you...  │  │ agent. Here's why 🧵 │   │
│  │                      │  │                      │   │
│  │ [Edit] [Publish]     │  │ [Edit] [Publish]     │   │
│  └─────────────────────┘  └─────────────────────┘   │
│                                                       │
│  ─────────────────────────────────────────────────   │
│                                                       │
│  📝 "Building in Public: Month 3"                    │
│  Detected from Substack · 3 days ago · Published ✓   │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Dashboard states per content card:**
- **Ready to review** — content generated, awaiting user action
- **Published** — posted to platform, shown with ✓ and timestamp
- **Skipped** — user dismissed this one

**Inline editing:** Click "Edit" → text becomes editable in-place. Optional "Refine" bar below (reuse from existing prototype): "make it punchier", "add a hook", "shorter", etc. These send the content + instruction to Claude for revision.

**[+URL] button:** Manual trigger. Paste any URL, Human fetches and generates content for all platforms. Same as auto-detected content from there. **Dedup check:** before generating, checks `sources` table for existing entry with same URL/GUID. If found, shows the existing generated content instead of creating duplicates.

**[Settings] page:**
- Substack RSS URL
- Brand voice (text description or paste examples → Claude distills)
- Connected platforms (LinkedIn, X) with OAuth connect/disconnect
- Platform toggles (which targets to generate for)

### Onboarding Flow

First-time user experience (replaces the old Configure tab):

1. Sign up / login (Supabase auth — existing)
2. "What's your Substack URL?" → enter URL, Human validates RSS feed exists
3. "Connect your platforms" → LinkedIn OAuth + X OAuth (existing OAuth flows)
4. "You're set! We're watching your Substack. When you publish, your content will appear here ready to review."

No voice configuration needed. Platform-optimized tones are built into each platform's prompt. Tone overrides and optional base voice description are available in Settings for power users.

### Content Engine

**Platform prompts (reuse from existing prototype.html):**

- **LinkedIn:** Professional, insight-driven post. Hook in first line. No hashtags. 150-300 words. First-person voice.
- **X/Twitter:** Thread format. Start with hook tweet. Each tweet max 280 chars. Separate tweets with `---`. 4-8 tweets. Punchy, conversational.
- **Rednote (P1):** 小红书笔记. 中文. 生活化语气. emoji适量. Cover hook + 2-3 content points + CTA. 200-400字. 文化本土化，不要直译.
- **note.com (P1):** Japanese long-form. Cultural adaptation for Japanese audience. Formal but approachable tone. Include section headers.

**Two-layer voice system:**

1. **Platform tone (smart defaults, primary):** Built-in knowledge of what tone performs well on each platform. Applied automatically. This is the main voice system — users don't configure it.

2. **Base voice (optional, power user):** An optional general voice description available in Settings. If set, it's layered underneath the platform tone as additional context (e.g., "I write about AI and startups"). Most users won't need this — the platform tones + the source content itself are enough.

| Platform | Default tone | Why |
|----------|-------------|-----|
| **X** | Punchy, provocative hooks, short sentences, hot takes, thread-native structure | Short-form virality rewards boldness and speed |
| **LinkedIn** | Professional but personal, story-driven, insight-first, hook in line 1 | Algorithm rewards dwell time and comments on thoughtful posts |
| **Rednote** (P1) | Casual 生活化, emoji-rich, list format, personal story, local references | Xiaohongshu culture rewards relatability and visual formatting |
| **note.com** (P1) | Formal but warm, structured headers, thorough, Japanese sensibility | Japanese readers expect completeness and respectful tone |

**How it works in the prompt:** The Claude system prompt uses the platform tone as the primary instruction: "Generate a [platform]-native post using these tone rules: [platform tone]. Source article: [content]." If the user has set a base voice in Settings, it's prepended: "The author's general voice: [base voice]."

**Settings (optional, power user):**
- Base voice description (optional text field)
- Per-platform tone override (optional — replaces the default tone for that platform)

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
| LinkedIn OAuth + publish | `web/src/app/api/publish/`, `web/src/lib/platforms/linkedin.ts` | Keep as-is, already in Next.js |
| X OAuth + thread publish | `web/src/lib/platforms/x.ts` | Keep as-is |
| Supabase schema | `supabase-setup.sql` | Reuse tables. **Migration needed:** `generated_content.status` expands from `draft/published` to full lifecycle states. |
| Rednote canvas carousel | `prototype.html` canvas code | Keep client-side for P0 dashboard. Port to server-side only if needed for P1 Telegram/API delivery. |
| Brand voice system | Configure tab logic | Move to Settings page + onboarding |
| Inline editing + refine bar | Generate tab UI | Move to review dashboard cards |
| Platform editor UI | `components/generate/` | Adapt for review dashboard layout |
| Next.js app shell | `web/` | Keep, simplify routing |

### What Gets Built New

| Component | Description |
|-----------|-------------|
| RSS watcher | Vercel Cron job (or standalone worker) polling Substack RSS every 15 min |
| Auto-generation pipeline | On new RSS item: fetch content → call Claude per platform → store results |
| Review dashboard | Single-screen view of all auto-generated content with publish controls |
| Onboarding flow | 4-step first-time setup (RSS URL, brand voice, OAuth, confirmation) |
| Settings page | Edit RSS URL, brand voice, platform connections |

### What Gets Removed

| Component | Reason |
|-----------|--------|
| Sources tab | Replaced by automatic RSS detection |
| Configure tab | Replaced by Settings page + onboarding |
| Generate tab "Generate" button | Generation is automatic, no manual trigger |
| Manual source type forms (5 types) | Replaced by RSS auto-detect + manual URL input |

## Content Lifecycle States

```
generated_content.status:
  generating     → Claude is producing content
  pending_review → ready for user to review in dashboard
  editing        → user clicked Edit, inline editor open
  approved       → user clicked Publish, publishing in progress
  published      → successfully posted to platform
  skipped        → user dismissed this content

Valid transitions:
  generating     → pending_review (generation complete)
  generating     → failed (Claude API error)
  pending_review → editing (user clicks Edit)
  pending_review → approved (user clicks Publish)
  pending_review → skipped (user dismisses)
  editing        → pending_review (user saves edit or abandons)
  approved       → published (API publish succeeds)
  approved       → failed (API publish fails)
  failed         → generating (user clicks Retry)

publish_log.status:
  published      → successfully posted via API
  draft          → copied to clipboard (Rednote, or fallback)
  failed         → API error, shown with Retry button in dashboard
```

**Schema migration required from existing codebase:**
- `generated_content.status`: expand from `'draft' | 'published'` to the full lifecycle above. Add `failed` status.
- `publish_log.status`: add `'failed'` (new, not in original schema).
- Add `generated_content.source_id` FK to link generated content back to source entry.

## RSS Deduplication

The Substack RSS watcher tracks processed posts by storing each post's RSS `<guid>` (or `<link>` as fallback) in the `sources` table. On each poll:
1. Fetch RSS feed
2. For each entry, check if `guid` exists in `sources` for this user
3. Skip already-processed entries
4. For new entries, create a `sources` row and trigger content generation

## Substack RSS Content Completeness

**Design decision:** Substack RSS feeds include full article HTML in the `<content:encoded>` field. This is sufficient for content generation. Fallback: if `<content:encoded>` is missing or truncated (<500 chars), Human fetches the full Substack page via HTTP and extracts content using cheerio + Readability. **Note:** Paywalled posts will be truncated in both RSS and HTTP fetch. P0 assumes free-tier content. Paywalled content handling is a P1 concern.

## Multi-Tenancy

P0 is single-user (founder only). The RSS watcher polls one feed. Multi-user support (shared poll loop or job queue) is a P2 concern. **P0 guardrail:** restrict signups to invite-only (reuse existing Supabase auth + a hardcoded allowed email list or invite code) to prevent unexpected multi-user load.

## Error Handling

- **RSS fetch failure:** Silent retry on next poll. Alert in dashboard if 3+ consecutive failures: "Can't reach your Substack feed. Check your RSS URL in Settings."
- **Content generation failure (Claude API):** Retry once after 5 seconds. If still failing, show in dashboard: "Couldn't generate content for '{title}' — [Retry]"
- **Publish failure:** Show in dashboard with error message + Retry button. Log to `publish_log` with status `failed`.
- **OAuth token expired:** Publisher layer attempts a token refresh using the stored `refresh_token` first. If refresh fails (token revoked or refresh token also expired), show reconnect prompt: "LinkedIn disconnected — [Reconnect]"

## P0 Success Criteria

- Founder actively uses it to repurpose Substack → LinkedIn + X for 2+ weeks
- Content quality: generated posts require <2 edits on average before publishing
- Latency: new Substack post → content appears in dashboard within 25 minutes on average
- Reliability: 0 missed posts over 2 weeks of monitoring

## P1 Scope (After P0 Validated)

- Rednote target: Chinese localization + carousel image generation (client-side canvas, reuse from prototype)
- note.com target: Japanese localization + publish/copy
- Expand manual URL input to accept any URL (not just Substack)
- Browser notification when new content is ready for review
- Analytics: track which repurposed posts get the most engagement per platform

## Open Questions

1. **note.com API:** Does note.com have a public API for posting? If not, publish mechanism is copy to clipboard only.
2. **Rednote carousel for P1:** Keep client-side canvas (already built in prototype) or port to server-side? Client-side is simpler since the dashboard is the primary interface. Recommend keeping client-side for P1.
3. **Rate limiting:** How often can you post to LinkedIn/X via API before hitting limits? Need to respect platform norms.
4. **Vercel Cron limits:** Hobby plan has 60s execution limit for cron jobs. Is RSS fetch + Claude generation for 2 platforms achievable within 60s? If not, need Pro plan or separate worker.
