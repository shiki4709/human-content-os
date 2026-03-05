# CLAUDE.md — Human Content OS

You are building **Human**, an AI-powered content OS that turns any source (articles, tweets, YouTube, notes) into platform-native posts for LinkedIn, X/Twitter, Substack, and Rednote 小红书.

The complete working prototype is in `prototype.html`. Read it first — it contains all UI, logic, and copy. Build the real app to match it exactly.

---

## Stack

- **Framework**: Next.js 14 (App Router)
- **Auth + DB**: Supabase
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude API (`claude-sonnet-4-5` model)
- **Publish APIs**: LinkedIn API v2, X API v2, Substack Partner API
- **Image cards**: HTML Canvas (already built in prototype — port as-is)
- **Deploy**: Vercel

---

## Project Structure

```
/app
  /auth          → login, signup, callback
  /dashboard     → main 4-tab app shell
  /api
    /generate    → POST: Claude content generation
    /sources     → POST: fetch/parse source content
    /publish     → POST: publish to LinkedIn / X / Substack
/components
  /sources       → AddSourceModal, SourceCard
  /configure     → BrandVoice, PlatformSelector
  /generate      → PlatformEditor, RednoteCarousel, XThread
  /publish       → PublishDashboard, ConnectionBar
/lib
  /supabase.ts   → client + server clients
  /anthropic.ts  → Claude API wrapper
  /platforms     → linkedin.ts, x.ts, substack.ts
/types
  index.ts       → Source, GeneratedContent, PublishEntry, Platform
```

---

## Database Schema (Supabase)

```sql
-- Users handled by Supabase Auth

create table sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  type text, -- 'url' | 'search' | 'youtube' | 'twitter' | 'notes'
  label text,
  content text,
  meta jsonb,
  selected boolean default true,
  created_at timestamptz default now()
);

create table generated_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  platform text, -- 'linkedin' | 'x' | 'substack' | 'rednote'
  content text,
  status text default 'draft', -- 'draft' | 'published'
  created_at timestamptz default now()
);

create table publish_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  platform text,
  content text,
  status text, -- 'published' | 'draft'
  platform_post_id text,
  created_at timestamptz default now()
);

create table platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  platform text, -- 'linkedin' | 'x' | 'substack'
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  meta jsonb,
  created_at timestamptz default now()
);
```

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=

X_CLIENT_ID=
X_CLIENT_SECRET=
X_REDIRECT_URI=

SUBSTACK_CLIENT_ID=
SUBSTACK_CLIENT_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Build Order — Follow This Exactly

### Phase 1 — Auth + Shell (start here)
1. Supabase auth: email/password + Google OAuth
2. Login page (`/app/auth/login`) — clean, minimal, "Human" branding
3. Signup page with onboarding (brand voice setup)
4. Dashboard shell with 4-tab nav: Sources → Configure → Generate → Publish
5. Protect all dashboard routes with Supabase middleware

### Phase 2 — Sources Tab
6. `AddSourceModal` with 5 source types matching prototype exactly:
   - 🔗 Social/Link (URL fetch)
   - 🔍 Web search (query + time range)
   - ▶️ YouTube channel (channel + video count)
   - 𝕏 X account (@handle + time period)
   - 📝 My notes (textarea)
7. Each type calls `/api/sources` which uses Claude to fetch/extract content
8. Source cards with select/deselect, stored in Supabase

### Phase 3 — Configure Tab
9. Selected sources display
10. Brand voice textarea (persisted to user profile)
11. Tone selector (Professional / Conversational / Bold / Educational)
12. Platform toggles: LinkedIn, X, Substack, Rednote (checked by default)

### Phase 4 — Generate Tab
13. Claude generation per platform using selected sources + brand voice
14. Platform-specific prompts (see prototype JS `PROMPTS` object)
15. Inline editing per platform
16. X/Twitter: thread format with individual tweet cards
17. Rednote: Chinese, culturally adapted
18. Refine bar: "make it punchier", "add a hook", etc.

### Phase 5 — Rednote Image Carousel
19. Port canvas image generator from prototype exactly
20. 6 curated backgrounds: 🌸 樱花, 🍵 抹茶, 💜 紫调, 🧈 奶油, 🌙 深夜, 🪸 珊瑚
21. 3-4 slides auto-split from content (cover, content x2, CTA)
22. ‹ › arrow navigation, dot indicators
23. Download slide as PNG
24. "🌸 Copy & draft" — copies text to clipboard, logs as draft

### Phase 6 — Publish Tab
25. Connection bar: LinkedIn OAuth, X OAuth, Substack OAuth
26. One-click publish to connected platforms
27. Publish log with status: `published` (green) or `copied as draft` (yellow)
28. Rednote shows "Paste into Rednote app" — never shows as published

---

## Key Product Rules

- **Rednote has no API** — copy to clipboard only, always log as `draft`
- **X posts** are threads — split on `---` separator, each chunk = one tweet
- **LinkedIn** posts are single long-form, no image generation
- **Substack** posts are long-form, drafted not published directly
- **Brand voice** is injected into every generation prompt
- **Sources** are user-scoped, never shared between users
- All platform content uses **platform-native language and format**
- Rednote content is always in **Chinese**, culturally adapted

---

## Content Generation Prompts

Use these exact platform prompts (already tuned in prototype):

```
linkedin:  Professional, insight-driven LinkedIn post. Hook in first line.
           No hashtags. 150-300 words. First-person voice.

x:         Twitter/X thread. Start with hook tweet. Each tweet max 280 chars.
           Separate tweets with ---. 4-8 tweets. Punchy, conversational.

substack:  Long-form newsletter section. Conversational but substantive.
           400-800 words. Include subheadings. Personal voice.

rednote:   小红书笔记. 中文. 生活化语气. emoji适量. 
           Cover hook + 2-3 content points + CTA. 200-400字.
           文化本土化，不要直译.
```

---

## UI/Design Rules

- Font: DM Sans (Google Fonts)
- Follow the button system in prototype exactly (btn-primary, btn-secondary, btn-accent, platform buttons)
- Rednote brand color: `#ff2442`
- LinkedIn: `#0a66c2`, X: `#000`, Substack: `#ff6719`
- Tab progress: Sources(1) → Configure(2) → Generate(3) → Publish(4)
- Toast notifications for all actions
- Mobile-responsive from day one

---

## What's Already Done (in prototype.html)

- Complete UI and all interactions
- Canvas image generation for Rednote (6 backgrounds, 3-4 slides)
- Source type forms with fetch flow
- Platform editor with inline editing
- X thread card UI
- Refine bar
- Publish dashboard

**Port the prototype — don't redesign it.**
