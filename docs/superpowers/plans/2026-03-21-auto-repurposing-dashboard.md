# Auto-Repurposing Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Human Content OS from a manual 4-tab dashboard into an auto-repurposing system that watches Substack via RSS, auto-generates LinkedIn + X content, and presents it in a simplified review/publish dashboard.

**Architecture:** Vercel Cron triggers two API routes: one polls RSS and deduplicates, the other generates content via Claude in parallel for LinkedIn + X. The existing 5-tab dashboard is replaced with a single review screen showing auto-generated content with Edit/Publish controls. Existing OAuth + publish logic is reused as-is.

**Tech Stack:** Next.js 14, Supabase, Anthropic Claude API (claude-sonnet-4-5), Vercel Cron, RSS parsing (rss-parser npm package)

**Spec:** `docs/superpowers/specs/2026-03-20-agentic-repurposing-design.md`

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/app/api/cron/poll-rss/route.ts` | Vercel Cron endpoint: poll Substack RSS, dedup, store new sources |
| `src/app/api/cron/generate/route.ts` | Vercel Cron endpoint: generate content for unprocessed sources |
| `src/lib/rss.ts` | RSS fetch + parse + content extraction logic |
| `src/lib/content-engine.ts` | Platform prompt definitions + Claude generation wrapper |
| `src/components/ReviewDashboard.tsx` | New single-screen review + publish dashboard |
| `src/components/ContentCard.tsx` | Per-source content card with platform sub-cards |
| `src/components/PlatformCard.tsx` | Per-platform content preview with Edit/Publish |
| `src/components/OnboardingFlow.tsx` | 3-step onboarding (RSS URL, OAuth, confirmation) |
| `src/app/dashboard/settings/page.tsx` | Settings: RSS URL, voice, platform connections |
| `src/app/api/generate-from-url/route.ts` | Authenticated manual URL → generate (no cron secret exposure) |
| `src/app/api/settings/route.ts` | GET/PUT user settings (RSS URL, base voice) |
| `src/app/api/onboarding/validate-rss/route.ts` | Validate RSS URL returns valid feed |
| `supabase/migrations/002_auto_repurpose.sql` | Schema migration for new statuses + columns |
| `vercel.json` | Vercel Cron schedule config |

### Modified Files

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add new status types, RSS source fields, user settings type |
| `src/app/dashboard/page.tsx` | Replace 5-tab shell with ReviewDashboard or OnboardingFlow |
| `src/components/DashboardShell.tsx` | Simplify to header + settings link (or remove entirely) |
| `src/app/api/publish/route.ts` | Add status transition logic (approved → published/failed) + token refresh |
| `src/app/api/refine/route.ts` | Reuse for inline edit (already works) |
| `src/app/api/sources/route.ts` | Add dedup check for manual URL input |
| `package.json` | Add `rss-parser` dependency |

### Kept As-Is (No Changes)

| File | Reason |
|------|--------|
| `src/lib/platforms/linkedin.ts` | OAuth + publish logic works |
| `src/lib/platforms/x.ts` | Thread posting logic works |
| `src/app/api/auth/linkedin/*` | OAuth flows work |
| `src/app/api/auth/x/*` | OAuth flows work |
| `src/app/api/connections/route.ts` | Connection management works |
| `src/components/generate/RednoteCarousel.tsx` | P1 — not needed for P0 |
| `src/components/Toast.tsx` | Reuse for notifications |

---

## Task 1: Schema Migration

**Files:**
- Create: `supabase/migrations/002_auto_repurpose.sql`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/002_auto_repurpose.sql

-- Add user settings columns
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb;
-- (Supabase stores user metadata in auth.users.raw_user_meta_data already)

-- Create user_settings table for RSS URL and voice
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  substack_rss_url text,
  base_voice text,
  onboarding_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- Add source_id FK to generated_content
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES sources(id);

-- Add rss_guid to sources for dedup
ALTER TABLE sources ADD COLUMN IF NOT EXISTS rss_guid text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS rss_published_at timestamptz;

-- Create index for RSS dedup lookups
CREATE INDEX IF NOT EXISTS idx_sources_rss_guid ON sources(user_id, rss_guid);

-- Expand generated_content.status
-- (Supabase doesn't enforce enum constraints on text, so just document the new values)
-- Old: 'draft' | 'published'
-- New: 'generating' | 'pending_review' | 'editing' | 'approved' | 'published' | 'skipped' | 'failed'

-- Add failed status tracking
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add failed to publish_log
ALTER TABLE publish_log ADD COLUMN IF NOT EXISTS error_message text;
```

- [ ] **Step 2: Update TypeScript types**

Add to `src/types/index.ts`:

```typescript
// Content lifecycle statuses
export type ContentStatus = 'generating' | 'pending_review' | 'editing' | 'approved' | 'published' | 'skipped' | 'failed';

// Extend Source with RSS fields
export interface Source {
  id: string;
  user_id: string;
  type: SourceType;
  label: string;
  content: string;
  meta: Record<string, unknown>;
  selected: boolean;
  created_at: string;
  rss_guid?: string;
  rss_published_at?: string;
}

// Extended GeneratedContent
export interface GeneratedContent {
  id: string;
  user_id: string;
  platform: Platform;
  content: string;
  status: ContentStatus;
  source_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// User settings
export interface UserSettings {
  id: string;
  user_id: string;
  substack_rss_url: string | null;
  base_voice: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Run migration against Supabase**

Run: `npx supabase db push` or apply via Supabase dashboard SQL editor.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_auto_repurpose.sql src/types/index.ts
git commit -m "feat: add schema migration for auto-repurposing (statuses, RSS fields, user_settings)"
```

---

## Task 2: RSS Watcher

**Files:**
- Create: `src/lib/rss.ts`
- Create: `src/app/api/cron/poll-rss/route.ts`
- Modify: `package.json` (add rss-parser)

- [ ] **Step 1: Install rss-parser**

Run: `npm install rss-parser`

- [ ] **Step 2: Write RSS fetch + parse module**

Create `src/lib/rss.ts`:

```typescript
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [['content:encoded', 'contentEncoded']],
  },
});

export interface RSSItem {
  guid: string;
  title: string;
  link: string;
  contentEncoded: string | undefined;
  pubDate: string | undefined;
}

export async function fetchSubstackRSS(rssUrl: string): Promise<RSSItem[]> {
  const feed = await parser.parseURL(rssUrl);
  return feed.items.map((item) => ({
    guid: item.guid || item.link || '',
    title: item.title || 'Untitled',
    link: item.link || '',
    contentEncoded: item.contentEncoded || item.content || '',
    pubDate: item.pubDate || item.isoDate || undefined,
  }));
}

export async function fetchFullContent(url: string): Promise<string> {
  // Fallback: fetch full page if RSS content is truncated
  const res = await fetch(url, { headers: { 'User-Agent': 'HumanContentOS/1.0' } });
  const html = await res.text();
  // Strip HTML tags for a basic text extraction
  // (For P0, this is sufficient. P1 could use cheerio + Readability.)
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 3: Write the poll-rss cron endpoint**

Create `src/app/api/cron/poll-rss/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchSubstackRSS, stripHtmlToText, fetchFullContent } from '@/lib/rss';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all users with RSS configured
  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id, substack_rss_url')
    .not('substack_rss_url', 'is', null)
    .eq('onboarding_complete', true);

  if (!settings || settings.length === 0) {
    return NextResponse.json({ message: 'No RSS feeds configured' });
  }

  let newPosts = 0;

  for (const setting of settings) {
    try {
      const items = await fetchSubstackRSS(setting.substack_rss_url);

      // Get existing GUIDs for this user
      const { data: existing } = await supabase
        .from('sources')
        .select('rss_guid')
        .eq('user_id', setting.user_id)
        .not('rss_guid', 'is', null);

      const existingGuids = new Set((existing || []).map((s) => s.rss_guid));

      for (const item of items) {
        if (!item.guid || existingGuids.has(item.guid)) continue;

        // Get content — use RSS content:encoded, fallback to fetching page
        let content = item.contentEncoded ? stripHtmlToText(item.contentEncoded) : '';
        if (content.length < 500 && item.link) {
          content = await fetchFullContent(item.link);
        }

        if (!content || content.length < 100) continue;

        // Store as new source
        await supabase.from('sources').insert({
          user_id: setting.user_id,
          type: 'url',
          label: item.title,
          content: content,
          meta: { url: item.link, rss: true },
          selected: true,
          rss_guid: item.guid,
          rss_published_at: item.pubDate || new Date().toISOString(),
        });

        newPosts++;
      }
    } catch (error) {
      console.error(`RSS fetch failed for user ${setting.user_id}:`, error);
      // Continue to next user — non-blocking
    }
  }

  // Trigger generation for new posts
  if (newPosts > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/cron/generate`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
  }

  return NextResponse.json({ newPosts });
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/rss.ts src/app/api/cron/poll-rss/route.ts
git commit -m "feat: add RSS watcher with Substack polling and dedup"
```

---

## Task 3: Content Engine + Auto-Generation

**Files:**
- Create: `src/lib/content-engine.ts`
- Create: `src/app/api/cron/generate/route.ts`

- [ ] **Step 1: Write the content engine**

Create `src/lib/content-engine.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Platform-specific prompts with built-in tone
const PLATFORM_PROMPTS: Record<string, string> = {
  linkedin: `Generate a LinkedIn post from the source article below.
Tone: Professional but personal, story-driven, insight-first.
Rules:
- Hook in first line (bold single-sentence opener, max 12 words)
- 1-2 sentence paragraphs for readability
- Structure: Hook → Personal insight → 3 actionable takeaways → Closing thought
- 150-300 words, conversational first-person
- No hashtags
- No corporate jargon
Output ONLY the post text, nothing else.`,

  x: `Generate a Twitter/X thread from the source article below.
Tone: Punchy, provocative, short sentences, hot takes.
Rules:
- Separate each tweet with --- on its own line
- Tweet 1 (hook): bold claim or surprising stat + "🧵" — max 240 chars
- Tweets 2-6: one idea per tweet, short punchy sentences, max 270 chars each
- Final tweet: question to followers or call to action
- 5-7 tweets total
- NEVER use em dashes. Use regular dashes (-) only.
- English ASCII punctuation only
Output ONLY the tweets separated by ---, nothing else.`,
};

export interface GenerationResult {
  platform: string;
  content: string;
}

export async function generateForPlatform(
  sourceContent: string,
  sourceTitle: string,
  platform: string,
  baseVoice?: string | null,
): Promise<string> {
  const prompt = PLATFORM_PROMPTS[platform];
  if (!prompt) throw new Error(`Unknown platform: ${platform}`);

  const systemParts = [prompt];
  if (baseVoice) {
    systemParts.unshift(`The author's general voice: ${baseVoice}`);
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    system: systemParts.join('\n\n'),
    messages: [
      {
        role: 'user',
        content: `Source article title: "${sourceTitle}"\n\nSource article content:\n${sourceContent}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.text || '';
}

export async function generateAllPlatforms(
  sourceContent: string,
  sourceTitle: string,
  platforms: string[],
  baseVoice?: string | null,
): Promise<GenerationResult[]> {
  // Generate in parallel
  const results = await Promise.all(
    platforms.map(async (platform) => {
      const content = await generateForPlatform(sourceContent, sourceTitle, platform, baseVoice);
      return { platform, content };
    }),
  );
  return results;
}
```

- [ ] **Step 2: Write the generate cron endpoint**

Create `src/app/api/cron/generate/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAllPlatforms } from '@/lib/content-engine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const P0_PLATFORMS = ['linkedin', 'x'];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find sources that don't have generated content yet
  // (sources with rss_guid that have no matching generated_content rows)
  const { data: sources } = await supabase
    .from('sources')
    .select('id, user_id, label, content')
    .not('rss_guid', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!sources || sources.length === 0) {
    return NextResponse.json({ message: 'No sources to process' });
  }

  let generated = 0;

  for (const source of sources) {
    // Check if content already generated for this source
    const { data: existing } = await supabase
      .from('generated_content')
      .select('id')
      .eq('source_id', source.id)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Get user's base voice (optional)
    const { data: settings } = await supabase
      .from('user_settings')
      .select('base_voice')
      .eq('user_id', source.user_id)
      .single();

    try {
      // Generate with 1 retry after 5s
      let results;
      try {
        results = await generateAllPlatforms(
          source.content, source.label, P0_PLATFORMS, settings?.base_voice,
        );
      } catch (firstError) {
        console.warn(`Generation attempt 1 failed for source ${source.id}, retrying in 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
        results = await generateAllPlatforms(
          source.content, source.label, P0_PLATFORMS, settings?.base_voice,
        );
      }

      // Store generated content
      for (const result of results) {
        await supabase.from('generated_content').insert({
          user_id: source.user_id,
          platform: result.platform,
          content: result.content,
          status: 'pending_review',
          source_id: source.id,
        });
      }

      generated++;
    } catch (error) {
      console.error(`Generation failed for source ${source.id} after retry:`, error);
      // Store failed state
      for (const platform of P0_PLATFORMS) {
        await supabase.from('generated_content').insert({
          user_id: source.user_id,
          platform,
          content: '',
          status: 'failed',
          source_id: source.id,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return NextResponse.json({ generated });
}
```

- [ ] **Step 3: Add Vercel Cron config**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/poll-rss",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

- [ ] **Step 4: Add CRON_SECRET to env**

Add to `.env.local`:
```
CRON_SECRET=your-random-secret-here
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/content-engine.ts src/app/api/cron/generate/route.ts vercel.json
git commit -m "feat: add content engine and auto-generation cron pipeline"
```

---

## Task 4: Onboarding Flow

**Files:**
- Create: `src/components/OnboardingFlow.tsx`
- Create: `src/app/api/onboarding/validate-rss/route.ts`
- Create: `src/app/api/settings/route.ts`

- [ ] **Step 1: Write RSS validation endpoint**

Create `src/app/api/onboarding/validate-rss/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { fetchSubstackRSS } from '@/lib/rss';

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ valid: false, error: 'URL is required' });
  }

  // Normalize: add /feed if missing
  let rssUrl = url.trim();
  if (!rssUrl.endsWith('/feed')) {
    rssUrl = rssUrl.replace(/\/$/, '') + '/feed';
  }

  try {
    const items = await fetchSubstackRSS(rssUrl);
    return NextResponse.json({
      valid: true,
      rssUrl,
      postCount: items.length,
      latestPost: items[0]?.title || null,
    });
  } catch {
    return NextResponse.json({ valid: false, error: 'Could not fetch RSS feed. Check the URL.' });
  }
}
```

- [ ] **Step 2: Write settings API**

Create `src/app/api/settings/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ settings: data });
}

export async function PUT(request: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      ...body,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
```

- [ ] **Step 3: Write OnboardingFlow component**

Create `src/components/OnboardingFlow.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface Props {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [rssUrl, setRssUrl] = useState('');
  const [validating, setValidating] = useState(false);
  const [rssValid, setRssValid] = useState<boolean | null>(null);
  const [rssError, setRssError] = useState('');
  const [latestPost, setLatestPost] = useState('');
  const [connections, setConnections] = useState<Record<string, boolean>>({});

  async function validateRss() {
    setValidating(true);
    setRssError('');
    try {
      const res = await fetch('/api/onboarding/validate-rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rssUrl }),
      });
      const data = await res.json();
      if (data.valid) {
        setRssValid(true);
        setLatestPost(data.latestPost || '');
        // Save RSS URL
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ substack_rss_url: data.rssUrl }),
        });
      } else {
        setRssValid(false);
        setRssError(data.error);
      }
    } catch {
      setRssValid(false);
      setRssError('Failed to validate. Try again.');
    }
    setValidating(false);
  }

  async function checkConnections() {
    const res = await fetch('/api/connections');
    const data = await res.json();
    setConnections({
      linkedin: data.connections?.linkedin?.connected || false,
      x: data.connections?.x?.connected || false,
    });
  }

  async function completeOnboarding() {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_complete: true }),
    });
    onComplete();
  }

  return (
    <div className="max-w-lg mx-auto py-16 px-6">
      <h1 className="text-2xl font-semibold mb-2">Set up Human</h1>
      <p className="text-[var(--text2)] mb-8">Step {step} of 3</p>

      {step === 1 && (
        <div>
          <h2 className="text-lg font-medium mb-4">What's your Substack URL?</h2>
          <input
            type="text"
            value={rssUrl}
            onChange={(e) => { setRssUrl(e.target.value); setRssValid(null); }}
            placeholder="https://yourname.substack.com"
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)]"
          />
          {rssError && <p className="text-red-500 text-sm mt-2">{rssError}</p>}
          {rssValid && (
            <p className="text-green-600 text-sm mt-2">
              Feed found! Latest post: "{latestPost}"
            </p>
          )}
          <button
            onClick={rssValid ? () => setStep(2) : validateRss}
            disabled={validating || !rssUrl.trim()}
            className="mt-4 w-full py-3 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
          >
            {validating ? 'Checking...' : rssValid ? 'Next' : 'Check Feed'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-lg font-medium mb-4">Connect your platforms</h2>
          <p className="text-[var(--text2)] mb-6">
            Human will publish repurposed content to these platforms.
          </p>
          <div className="space-y-3">
            <a
              href="/api/auth/linkedin"
              onClick={() => setTimeout(checkConnections, 5000)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-[var(--border)]"
            >
              <span>🔵 LinkedIn</span>
              <span>{connections.linkedin ? '✓ Connected' : 'Connect →'}</span>
            </a>
            <a
              href="/api/auth/x"
              onClick={() => setTimeout(checkConnections, 5000)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-[var(--border)]"
            >
              <span>⬛ X / Twitter</span>
              <span>{connections.x ? '✓ Connected' : 'Connect →'}</span>
            </a>
          </div>
          <button
            onClick={() => setStep(3)}
            className="mt-6 w-full py-3 rounded-lg bg-[var(--accent)] text-white font-medium"
          >
            {connections.linkedin || connections.x ? 'Next' : 'Skip for now'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="text-lg font-medium mb-4">You're all set!</h2>
          <p className="text-[var(--text2)] mb-6">
            Human is now watching your Substack. When you publish a new post,
            we'll auto-generate LinkedIn and X versions. Open this dashboard
            anytime to review and publish them.
          </p>
          <button
            onClick={completeOnboarding}
            className="w-full py-3 rounded-lg bg-[var(--accent)] text-white font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/OnboardingFlow.tsx src/app/api/onboarding/validate-rss/route.ts src/app/api/settings/route.ts
git commit -m "feat: add onboarding flow (RSS URL, OAuth, confirmation)"
```

---

## Task 5: Review Dashboard

**Files:**
- Create: `src/components/ReviewDashboard.tsx`
- Create: `src/components/ContentCard.tsx`
- Create: `src/components/PlatformCard.tsx`

- [ ] **Step 1: Write PlatformCard component**

Create `src/components/PlatformCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { GeneratedContent } from '@/types';

const PLATFORM_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  linkedin: { color: '#0a66c2', icon: '🔵', label: 'LinkedIn' },
  x: { color: '#000', icon: '⬛', label: 'X Thread' },
};

interface Props {
  content: GeneratedContent;
  onPublish: (id: string) => Promise<void>;
  onRefine: (id: string, instruction: string) => Promise<void>;
}

export default function PlatformCard({ content, onPublish, onRefine }: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content.content);
  const [refineInput, setRefineInput] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [refining, setRefining] = useState(false);

  const style = PLATFORM_STYLES[content.platform] || { color: '#666', icon: '📝', label: content.platform };

  async function handlePublish() {
    setPublishing(true);
    await onPublish(content.id);
    setPublishing(false);
  }

  async function handleRefine() {
    if (!refineInput.trim()) return;
    setRefining(true);
    await onRefine(content.id, refineInput);
    setRefineInput('');
    setRefining(false);
    setEditing(false);
  }

  // Format X threads for display
  function formatContent(text: string, platform: string) {
    if (platform === 'x') {
      // Parse TWEET_N: format
      const tweets = text.split('---').map((t) => t.trim()).filter(Boolean);
      if (tweets.length > 1) {
        return tweets.map((tweet, i) => (
          <div key={i} className="py-2 px-3 mb-2 rounded border border-[var(--border)] text-sm">
            <span className="text-[var(--text3)] text-xs">{i + 1}/{tweets.length}</span>
            <p className="mt-1">{tweet}</p>
          </div>
        ));
      }
    }
    return <p className="text-sm whitespace-pre-wrap">{text}</p>;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span>{style.icon}</span>
        <span className="font-medium text-sm">{style.label}</span>
        {content.status === 'published' && (
          <span className="ml-auto text-xs text-green-600">✓ Published</span>
        )}
        {content.status === 'failed' && (
          <span className="ml-auto text-xs text-red-500">Failed</span>
        )}
      </div>

      <div className="flex-1 mb-3 max-h-64 overflow-y-auto">
        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full h-40 p-2 text-sm rounded border border-[var(--border)] bg-[var(--bg)] resize-none"
          />
        ) : (
          formatContent(content.content, content.platform)
        )}
      </div>

      {editing && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={refineInput}
            onChange={(e) => setRefineInput(e.target.value)}
            placeholder="Make it punchier, add a hook..."
            className="flex-1 px-3 py-2 text-sm rounded border border-[var(--border)] bg-[var(--bg)]"
          />
          <button
            onClick={handleRefine}
            disabled={refining}
            className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-white"
          >
            {refining ? '...' : 'Refine'}
          </button>
        </div>
      )}

      {content.status === 'pending_review' && (
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="flex-1 py-2 text-sm rounded border border-[var(--border)] hover:bg-[var(--bg3)]"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 py-2 text-sm rounded bg-[var(--accent)] text-white"
          >
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write ContentCard component**

Create `src/components/ContentCard.tsx`:

```tsx
'use client';

import type { Source, GeneratedContent } from '@/types';
import PlatformCard from './PlatformCard';

interface Props {
  source: Source;
  content: GeneratedContent[];
  onPublish: (contentId: string) => Promise<void>;
  onRefine: (contentId: string, instruction: string) => Promise<void>;
}

export default function ContentCard({ source, content, onPublish, onRefine }: Props) {
  const timeAgo = getTimeAgo(source.rss_published_at || source.created_at);
  const allPublished = content.every((c) => c.status === 'published');

  return (
    <div className="mb-8">
      <div className="mb-3">
        <h3 className="text-lg font-medium">{source.label}</h3>
        <p className="text-sm text-[var(--text3)]">
          From Substack · {timeAgo}
          {allPublished && ' · Published ✓'}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {content.map((c) => (
          <PlatformCard
            key={c.id}
            content={c}
            onPublish={onPublish}
            onRefine={onRefine}
          />
        ))}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 3: Write ReviewDashboard component**

Create `src/components/ReviewDashboard.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { Source, GeneratedContent } from '@/types';
import ContentCard from './ContentCard';

interface SourceWithContent {
  source: Source;
  content: GeneratedContent[];
}

export default function ReviewDashboard() {
  const [items, setItems] = useState<SourceWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualUrl, setManualUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    setLoading(true);
    const res = await fetch('/api/review-content');
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  async function handlePublish(contentId: string) {
    const content = items
      .flatMap((i) => i.content)
      .find((c) => c.id === contentId);
    if (!content) return;

    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: content.platform, content: content.content }),
    });

    if (res.ok) {
      // Update status locally
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          content: item.content.map((c) =>
            c.id === contentId ? { ...c, status: 'published' as const } : c,
          ),
        })),
      );
    }
  }

  async function handleRefine(contentId: string, instruction: string) {
    const content = items
      .flatMap((i) => i.content)
      .find((c) => c.id === contentId);
    if (!content) return;

    const res = await fetch('/api/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: content.platform,
        content: content.content,
        instruction,
        isThread: content.platform === 'x',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          content: item.content.map((c) =>
            c.id === contentId ? { ...c, content: data.content } : c,
          ),
        })),
      );
    }
  }

  async function handleManualUrl() {
    if (!manualUrl.trim()) return;
    setSubmitting(true);
    // Dedicated endpoint: fetches URL, dedup checks, generates, returns content
    await fetch('/api/generate-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: manualUrl }),
    });
    setManualUrl('');
    setSubmitting(false);
    await loadContent();
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Human</h1>
        <div className="flex gap-3">
          <a href="/dashboard/settings" className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--bg2)]">
            Settings
          </a>
        </div>
      </div>

      {/* Manual URL input */}
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder="Paste a URL to repurpose..."
          className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-sm"
        />
        <button
          onClick={handleManualUrl}
          disabled={submitting || !manualUrl.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-white disabled:opacity-50"
        >
          {submitting ? '...' : '+URL'}
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--text3)]">Loading...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-[var(--text3)]">
          <p className="text-lg mb-2">No content yet</p>
          <p className="text-sm">Publish a Substack post and it will appear here automatically.</p>
        </div>
      ) : (
        items.map((item) => (
          <ContentCard
            key={item.source.id}
            source={item.source}
            content={item.content}
            onPublish={handlePublish}
            onRefine={handleRefine}
          />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PlatformCard.tsx src/components/ContentCard.tsx src/components/ReviewDashboard.tsx
git commit -m "feat: add review dashboard with content cards, edit, and publish controls"
```

---

## Task 6: Review Content API + Dashboard Wiring

**Files:**
- Create: `src/app/api/review-content/route.ts`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Write review-content API**

Create `src/app/api/review-content/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get sources with RSS content (auto-detected)
  const { data: sources } = await supabase
    .from('sources')
    .select('*')
    .eq('user_id', user.id)
    .not('rss_guid', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!sources || sources.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Get generated content for these sources
  const sourceIds = sources.map((s) => s.id);
  const { data: content } = await supabase
    .from('generated_content')
    .select('*')
    .in('source_id', sourceIds)
    .order('created_at', { ascending: false });

  // Group content by source
  const items = sources.map((source) => ({
    source,
    content: (content || []).filter((c) => c.source_id === source.id),
  })).filter((item) => item.content.length > 0);

  return NextResponse.json({ items });
}
```

- [ ] **Step 2: Update dashboard page to use ReviewDashboard or Onboarding**

Modify `src/app/dashboard/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import ReviewDashboard from '@/components/ReviewDashboard';
import OnboardingFlow from '@/components/OnboardingFlow';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, []);

  async function checkOnboarding() {
    const res = await fetch('/api/settings');
    const data = await res.json();
    setOnboarded(data.settings?.onboarding_complete || false);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (!onboarded) {
    return <OnboardingFlow onComplete={() => setOnboarded(true)} />;
  }

  return <ReviewDashboard />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/review-content/route.ts src/app/dashboard/page.tsx
git commit -m "feat: wire review dashboard with onboarding gate and content API"
```

---

## Task 7: Settings Page

**Files:**
- Create: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Write settings page**

Create `src/app/dashboard/settings/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [rssUrl, setRssUrl] = useState('');
  const [baseVoice, setBaseVoice] = useState('');
  const [connections, setConnections] = useState<Record<string, { connected: boolean; name?: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
    loadConnections();
  }, []);

  async function loadSettings() {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.settings) {
      setRssUrl(data.settings.substack_rss_url || '');
      setBaseVoice(data.settings.base_voice || '');
    }
  }

  async function loadConnections() {
    const res = await fetch('/api/connections');
    const data = await res.json();
    setConnections(data.connections || {});
  }

  async function save() {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ substack_rss_url: rssUrl, base_voice: baseVoice || null }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function disconnect(platform: string) {
    await fetch('/api/connections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    });
    loadConnections();
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <a href="/dashboard" className="text-sm text-[var(--accent)]">← Back</a>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Substack RSS URL</label>
          <input
            type="text"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
            placeholder="https://yourname.substack.com/feed"
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg2)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Base Voice <span className="text-[var(--text3)] font-normal">(optional)</span>
          </label>
          <textarea
            value={baseVoice}
            onChange={(e) => setBaseVoice(e.target.value)}
            placeholder="e.g., I write about AI and startups, direct and conversational"
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg2)] resize-none"
          />
          <p className="text-xs text-[var(--text3)] mt-1">
            Platform-specific tones are applied automatically. This is additional context about your general style.
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
        </button>

        <hr className="border-[var(--border)]" />

        <div>
          <h2 className="text-sm font-medium mb-3">Connected Platforms</h2>
          <div className="space-y-3">
            {['linkedin', 'x'].map((platform) => {
              const conn = connections[platform];
              return (
                <div key={platform} className="flex items-center justify-between px-4 py-3 rounded-lg border border-[var(--border)]">
                  <span>{platform === 'linkedin' ? '🔵 LinkedIn' : '⬛ X / Twitter'}</span>
                  {conn?.connected ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-green-600">✓ {conn.name || 'Connected'}</span>
                      <button
                        onClick={() => disconnect(platform)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <a href={`/api/auth/${platform}`} className="text-sm text-[var(--accent)]">
                      Connect →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat: add settings page (RSS URL, base voice, platform connections)"
```

---

## Task 8: End-to-End Testing

- [ ] **Step 1: Test onboarding flow**

Run: `npm run dev`
1. Open `http://localhost:3000/dashboard`
2. Should see onboarding (step 1: Substack URL)
3. Enter a real Substack URL, click "Check Feed"
4. Should validate and show latest post title
5. Click "Next" → step 2 (connect platforms)
6. Click "Skip for now" → step 3 (confirmation)
7. Click "Go to Dashboard" → should see empty review dashboard

- [ ] **Step 2: Test RSS polling manually**

```bash
# Trigger the poll-rss endpoint manually
curl -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/cron/poll-rss
# Should return { "newPosts": N }
```

- [ ] **Step 3: Test auto-generation manually**

```bash
# Trigger the generate endpoint manually
curl -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/cron/generate
# Should return { "generated": N }
```

- [ ] **Step 4: Verify dashboard shows generated content**

1. Refresh `http://localhost:3000/dashboard`
2. Should see content cards with LinkedIn + X versions
3. Test "Edit" → type instruction → "Refine"
4. Test "Publish" (if platforms connected) or verify button works

- [ ] **Step 5: Test manual URL input**

1. Paste a Substack URL in the "+URL" input
2. Click the button
3. Should generate and show content

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "feat: complete auto-repurposing dashboard P0"
```

---

## Summary

| Task | What | New Files | Est. Time |
|------|------|-----------|-----------|
| 1 | Schema migration + types | 2 | 5 min |
| 2 | RSS watcher | 2 | 10 min |
| 3 | Content engine + auto-gen | 3 | 10 min |
| 4 | Onboarding flow | 3 | 10 min |
| 5 | Review dashboard | 3 | 15 min |
| 6 | API wiring + dashboard page | 2 | 5 min |
| 7 | Settings page | 1 | 10 min |
| 8 | E2E testing | 0 | 15 min |
| **Total** | | **16 new files** | **~80 min** |

---

## Implementation Notes (resolve during execution)

These are known issues from the plan review that should be addressed during implementation:

1. **`/api/generate-from-url` endpoint** — needs to be created (Task 5 references it). Should: check auth, dedup against `sources` table by URL, fetch content, call `generateAllPlatforms`, store results. Authenticated route (no cron secret).
2. **`handlePublish` must update `generated_content.status`** — after calling `/api/publish`, also PATCH the `generated_content` row to `'published'` or `'failed'` in Supabase.
3. **PlatformCard inline edit save** — when user edits text manually (not via Refine), the edited text needs to be persisted. Either add a "Save" button or use `editText` (not `content.content`) when publishing.
4. **OAuth token refresh** — add to `/api/publish/route.ts`: before returning `TOKEN_EXPIRED`, attempt `refresh_token` exchange. Existing code in `x.ts` and `linkedin.ts` may need a `refreshToken()` helper.
5. **RSS failure tracking** — add `rss_fail_count` to `user_settings`, increment in poll-rss on error, reset on success. Dashboard queries this to show alert.
6. **Review-content API should also return manually-added sources** — current query filters `not('rss_guid', 'is', null)` which excludes manual URL sources. Fix: also include sources without `rss_guid` that have `generated_content` rows.
7. **After Vercel deployment** — verify cron triggers correctly in Vercel dashboard logs. Check if 60s limit is hit (Claude parallel generation for 2 platforms should be ~15-20s).
