import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchSubstackRSS, stripHtmlToText, fetchFullContent } from '@/lib/rss';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Verify cron secret
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

      const existingGuids = new Set((existing || []).map((s: { rss_guid: string }) => s.rss_guid));

      for (const item of items) {
        if (!item.guid || existingGuids.has(item.guid)) continue;

        let content = item.contentEncoded ? stripHtmlToText(item.contentEncoded) : '';
        if (content.length < 500 && item.link) {
          content = await fetchFullContent(item.link);
        }

        if (!content || content.length < 100) continue;

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

      // Reset fail count on success
      await supabase
        .from('user_settings')
        .update({ rss_fail_count: 0 })
        .eq('user_id', setting.user_id);

    } catch (error) {
      console.error(`RSS fetch failed for user ${setting.user_id}:`, error);
      // Increment fail count
      // Simple increment — fetch current count first
      const { data: currentSettings } = await supabase
        .from('user_settings')
        .select('rss_fail_count')
        .eq('user_id', setting.user_id)
        .single();
      const currentCount = currentSettings?.rss_fail_count ?? 0;
      await supabase
        .from('user_settings')
        .update({ rss_fail_count: currentCount + 1 })
        .eq('user_id', setting.user_id);
    }
  }

  // Trigger generation for new posts
  if (newPosts > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/cron/generate`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch((e) => console.error('Failed to trigger generation:', e));
  }

  return NextResponse.json({ newPosts });
}
