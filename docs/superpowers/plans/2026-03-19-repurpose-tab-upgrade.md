# Repurpose Tab Upgrade — Newsletter-First Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Repurpose tab the primary "newsletter → everywhere" fast lane — connected to shared state (brand voice, tone, platforms), with Substack URL detection and results that flow into the Publish tab.

**Architecture:** Wire RepurposeTab into DashboardShell's shared state (brandVoice, tone, enabledPlatforms, generatedContent) instead of using isolated local state. Add Substack URL detection for optimized newsletter fetching. Move Repurpose to tab position #1. Results feed into the same generatedContent state that Publish tab reads from.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Anthropic Claude API

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/DashboardShell.tsx` | Modify | Pass shared state to RepurposeTab, reorder tabs |
| `src/components/tabs/RepurposeTab.tsx` | Modify | Accept shared state props, Substack detection, feed results to shared state |
| `src/app/api/sources/route.ts` | Modify | Add Substack-optimized fetch prompt |

---

### Task 1: Reorder tabs — Repurpose becomes #1

**Files:**
- Modify: `src/components/DashboardShell.tsx:17-23` (TABS array)

- [ ] **Step 1: Update TABS array order**

In `src/components/DashboardShell.tsx`, change the TABS array from:

```typescript
const TABS: { key: Tab; label: string; num: number }[] = [
  { key: 'sources', label: 'Sources', num: 1 },
  { key: 'repurpose', label: 'Repurpose', num: 2 },
  { key: 'configure', label: 'Configure', num: 3 },
  { key: 'generate', label: 'Generate', num: 4 },
  { key: 'publish', label: 'Publish', num: 5 },
]
```

To:

```typescript
const TABS: { key: Tab; label: string; num: number }[] = [
  { key: 'repurpose', label: 'Repurpose', num: 1 },
  { key: 'sources', label: 'Sources', num: 2 },
  { key: 'configure', label: 'Configure', num: 3 },
  { key: 'generate', label: 'Generate', num: 4 },
  { key: 'publish', label: 'Publish', num: 5 },
]
```

- [ ] **Step 2: Change default active tab**

In `src/components/DashboardShell.tsx`, change:

```typescript
const [activeTab, setActiveTab] = useState<Tab>('sources')
```

To:

```typescript
const [activeTab, setActiveTab] = useState<Tab>('repurpose')
```

- [ ] **Step 3: Verify the app builds**

Run: `cd /Users/harukamorimori/Downloads/human-content-os && npx next build 2>&1 | tail -5`
Expected: Build succeeds (or only pre-existing warnings)

- [ ] **Step 4: Commit**

```bash
cd /Users/harukamorimori/Downloads/human-content-os
git add src/components/DashboardShell.tsx
git commit -m "feat: reorder tabs — Repurpose is now tab #1"
```

---

### Task 2: Wire RepurposeTab to shared state

**Files:**
- Modify: `src/components/tabs/RepurposeTab.tsx` (add props interface, remove local platform state)
- Modify: `src/components/DashboardShell.tsx:266-268` (pass props to RepurposeTab)

- [ ] **Step 1: Add props interface to RepurposeTab**

In `src/components/tabs/RepurposeTab.tsx`, replace the component signature and remove local platform state. Change:

```typescript
export default function RepurposeTab() {
  const [input, setInput] = useState('')
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({
    linkedin: true,
    x: true,
    substack: false,
    rednote: false,
  })
  const [results, setResults] = useState<Record<string, string>>({})
```

To:

```typescript
type Props = {
  brandVoice: string
  tone: string
  enabledPlatforms: Record<string, boolean>
  onGeneratedContentChange: (content: Record<string, string>) => void
  onNavigateToPublish: () => void
}

export default function RepurposeTab({
  brandVoice,
  tone,
  enabledPlatforms,
  onGeneratedContentChange,
  onNavigateToPublish,
}: Props) {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<Record<string, string>>({})
```

- [ ] **Step 2: Update handleRepurpose to use shared state**

In `RepurposeTab.tsx`, in the `handleRepurpose` function, replace the platform selection and generation call. Change:

```typescript
    if (selectedPlatforms.length === 0) {
      toast('Select at least one platform')
      return
    }
```

To:

```typescript
    if (selectedPlatforms.length === 0) {
      toast('Enable platforms in Configure tab')
      return
    }
```

And change the generation body from:

```typescript
      body: JSON.stringify({
          sources: [{ label: isUrl(trimmed) ? trimmed : 'Pasted content', content: sourceContent }],
          platforms: selectedPlatforms,
          brandVoice: '',
          tone: 'Thought leader',
        }),
```

To:

```typescript
      body: JSON.stringify({
          sources: [{ label: isUrl(trimmed) ? trimmed : 'Pasted content', content: sourceContent }],
          platforms: selectedPlatforms,
          brandVoice,
          tone,
        }),
```

- [ ] **Step 3: Feed results into shared generatedContent**

In `RepurposeTab.tsx`, after `setResults(data.results || {})`, add a call to push results to shared state:

```typescript
      setResults(data.results || {})
      onGeneratedContentChange(data.results || {})
      toast('Content repurposed')
```

- [ ] **Step 4: Replace local platform checkboxes with shared enabledPlatforms**

In `RepurposeTab.tsx`, replace `selectedPlatforms` derivation. Change:

```typescript
  const selectedPlatforms = Object.keys(platforms).filter(k => platforms[k])
```

To:

```typescript
  const selectedPlatforms = Object.keys(enabledPlatforms).filter(k => enabledPlatforms[k])
```

- [ ] **Step 5: Replace the platform checkbox UI with a read-only summary**

In `RepurposeTab.tsx`, replace the "Target platforms" section (the `<div className="mb-5">` block containing platform checkboxes) with:

```tsx
        {/* Platform summary */}
        <div className="mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-text3 mb-2.5">
            Posting to
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedPlatforms.map(pk => {
              const meta = PLATS[pk]
              if (!meta) return null
              return (
                <span
                  key={pk}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-acb bg-acl text-[12px] font-medium text-accent"
                >
                  <span className="text-[13px]">{meta.icon}</span>
                  {meta.name}
                </span>
              )
            })}
            {selectedPlatforms.length === 0 && (
              <span className="text-[12px] text-text3">No platforms enabled — configure in the Configure tab</span>
            )}
          </div>
        </div>
```

- [ ] **Step 6: Add "Go to Publish" button after results**

In `RepurposeTab.tsx`, after the results section (after the closing `</div>` of `{hasResults && (...)}`), add:

```tsx
        {hasResults && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onNavigateToPublish}
              className="px-5 py-2.5 rounded-[9px] bg-text text-bg font-semibold text-[13.5px] transition-all hover:bg-[#2a2926] hover:-translate-y-px hover:shadow-md"
            >
              Publish content →
            </button>
          </div>
        )}
```

- [ ] **Step 7: Pass shared state from DashboardShell to RepurposeTab**

In `src/components/DashboardShell.tsx`, change:

```tsx
        <div className={activeTab === 'repurpose' ? 'flex flex-col h-full' : 'hidden'}>
          <RepurposeTab />
        </div>
```

To:

```tsx
        <div className={activeTab === 'repurpose' ? 'flex flex-col h-full' : 'hidden'}>
          <RepurposeTab
            brandVoice={brandVoice}
            tone={tone}
            enabledPlatforms={enabledPlatforms}
            onGeneratedContentChange={(content) => {
              setGeneratedContent(content)
              handleGenerationComplete(content, '')
            }}
            onNavigateToPublish={() => setActiveTab('publish')}
          />
        </div>
```

- [ ] **Step 8: Verify the app builds**

Run: `cd /Users/harukamorimori/Downloads/human-content-os && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
cd /Users/harukamorimori/Downloads/human-content-os
git add src/components/tabs/RepurposeTab.tsx src/components/DashboardShell.tsx
git commit -m "feat: wire RepurposeTab to shared brand voice, tone, platforms, and publish flow"
```

---

### Task 3: Add Substack URL detection and optimized fetch

**Files:**
- Modify: `src/components/tabs/RepurposeTab.tsx` (Substack detection UI)
- Modify: `src/app/api/sources/route.ts` (Substack-optimized prompt)

- [ ] **Step 1: Add Substack URL detection helper to RepurposeTab**

In `src/components/tabs/RepurposeTab.tsx`, after the `isUrl` function, add:

```typescript
function isSubstackUrl(str: string): boolean {
  return /^https?:\/\/[^/]*\.substack\.com\//i.test(str.trim()) ||
         /^https?:\/\/[^/]*\/p\//i.test(str.trim()) && /substack/i.test(str)
}
```

- [ ] **Step 2: Add Substack badge in input area**

In `RepurposeTab.tsx`, right after the `<textarea>` element in the input area, add:

```tsx
          {isSubstackUrl(input) && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-[#fff7ed] border border-[#ff6719]/20">
              <span className="text-[13px]">📧</span>
              <span className="text-[12px] font-medium text-[#c2410c]">Newsletter detected</span>
              <span className="text-[11px] text-[#c2410c]/70">— optimized extraction for Substack articles</span>
            </div>
          )}
```

- [ ] **Step 3: Pass source type hint in fetch call**

In `RepurposeTab.tsx`, in `handleRepurpose`, change the source fetch body from:

```typescript
        body: JSON.stringify({ type: 'url', extra: { url: trimmed } }),
```

To:

```typescript
        body: JSON.stringify({
          type: 'url',
          extra: { url: trimmed, hint: isSubstackUrl(trimmed) ? 'substack-newsletter' : undefined },
        }),
```

- [ ] **Step 4: Add Substack-optimized prompt in sources API**

In `src/app/api/sources/route.ts`, add a new prompt entry. Change the PROMPTS object from:

```typescript
const PROMPTS: Record<string, (p: Record<string, string>) => string> = {
  url: (p) => `Fetch this URL and extract the full key content as if you loaded the page: ${p.url}

Return a rich summary with headline, main arguments, key data points, and quotes. 300-600 words.`,
```

To:

```typescript
const PROMPTS: Record<string, (p: Record<string, string>) => string> = {
  url: (p) => {
    if (p.hint === 'substack-newsletter') {
      return `Fetch this Substack newsletter and extract the FULL article content: ${p.url}

This is a newsletter that will be repurposed into social media posts. Extract:
- The main thesis/argument
- All key points and insights (preserve the author's original framing)
- Notable quotes or data points
- The narrative arc and structure

Return the complete content — do NOT summarize or shorten. 500-1500 words. Preserve the author's voice.`
    }
    return `Fetch this URL and extract the full key content as if you loaded the page: ${p.url}

Return a rich summary with headline, main arguments, key data points, and quotes. 300-600 words.`
  },
```

- [ ] **Step 5: Update the Repurpose button label for newsletter**

In `RepurposeTab.tsx`, change the button text from:

```tsx
            <>✦ {isUrl(input.trim()) ? 'Fetch & Repurpose' : 'Repurpose'}</>
```

To:

```tsx
            <>✦ {isSubstackUrl(input.trim()) ? 'Repurpose newsletter' : isUrl(input.trim()) ? 'Fetch & Repurpose' : 'Repurpose'}</>
```

- [ ] **Step 6: Verify the app builds**

Run: `cd /Users/harukamorimori/Downloads/human-content-os && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
cd /Users/harukamorimori/Downloads/human-content-os
git add src/components/tabs/RepurposeTab.tsx src/app/api/sources/route.ts
git commit -m "feat: add Substack newsletter detection with optimized content extraction"
```

---

### Task 4: Clean up — remove unused local state and imports

**Files:**
- Modify: `src/components/tabs/RepurposeTab.tsx` (remove unused `platforms`/`setPlatforms` if any remain)

- [ ] **Step 1: Verify no references to removed local platform state**

Search RepurposeTab.tsx for any remaining references to the old local `platforms` state or `setPlatforms`. These should have been removed in Task 2. If any remain, remove them.

- [ ] **Step 2: Verify the app builds clean**

Run: `cd /Users/harukamorimori/Downloads/human-content-os && npx next build 2>&1 | tail -10`
Expected: Build succeeds with no TypeScript errors related to RepurposeTab

- [ ] **Step 3: Manual smoke test**

Run: `cd /Users/harukamorimori/Downloads/human-content-os && npm run dev`

Test flow:
1. App opens on Repurpose tab (not Sources)
2. Platform summary shows the configured platforms (LinkedIn, X, Substack, Rednote by default)
3. Paste a Substack URL — "Newsletter detected" badge appears
4. Button says "Repurpose newsletter"
5. After generation, results appear with each platform's content
6. "Publish content →" button navigates to Publish tab
7. Publish tab shows the generated content ready to publish

- [ ] **Step 4: Commit if any cleanup was needed**

```bash
cd /Users/harukamorimori/Downloads/human-content-os
git add -A
git commit -m "chore: clean up unused state from RepurposeTab refactor"
```
