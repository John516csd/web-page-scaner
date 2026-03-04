import { XMLParser } from 'fast-xml-parser';

const MAX_SITEMAP_DEPTH = 3;

export async function fetchSitemapUrls(url: string, depth = 0): Promise<string[]> {
  if (depth > MAX_SITEMAP_DEPTH) return [];

  const response = await fetch(url, {
    headers: { 'User-Agent': 'WebPageScanner/1.0' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const xml = await response.text();
  const parser = new XMLParser();
  const parsed = parser.parse(xml);

  if (parsed.urlset?.url) {
    const entries = Array.isArray(parsed.urlset.url)
      ? parsed.urlset.url
      : [parsed.urlset.url];
    return entries.map((u: { loc: string }) => u.loc).filter(Boolean);
  }

  if (parsed.sitemapindex?.sitemap) {
    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];
    const childUrls = sitemaps.map((s: { loc: string }) => s.loc).filter(Boolean);

    const results = await Promise.all(
      childUrls.map((childUrl: string) =>
        fetchSitemapUrls(childUrl, depth + 1).catch(() => [] as string[])
      )
    );
    return results.flat();
  }

  return [];
}
