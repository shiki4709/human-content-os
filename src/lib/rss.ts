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
  const res = await fetch(url, { headers: { 'User-Agent': 'HumanContentOS/1.0' } });
  const html = await res.text();
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
