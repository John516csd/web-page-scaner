import { XMLParser } from 'fast-xml-parser';

export const INDEXNOW_KEY = '5b017f636ab52a762d9377df65bd4e32';

export function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, ensureTrailingSlash(baseUrl)).toString();
}

export function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

export function normalizeUrlForCompare(url: string, baseUrl?: string): string {
  try {
    const parsed = baseUrl ? new URL(url, baseUrl) : new URL(url);
    if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '');
  }
}

export async function fetchTextManual(url: string): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
  location?: string;
  durationMs: number;
}> {
  const start = Date.now();
  const response = await fetch(url, {
    redirect: 'manual',
    headers: { 'User-Agent': 'WebPageScanner/1.0' },
  });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const body = await response.text().catch(() => '');
  return {
    status: response.status,
    headers,
    body,
    location: response.headers.get('location') || undefined,
    durationMs: Date.now() - start,
  };
}

export function parseXml(xml: string): unknown {
  const parser = new XMLParser();
  return parser.parse(xml);
}

export function extractLocsFromSitemapXml(xml: string): string[] {
  const parsed = parseXml(xml) as {
    urlset?: { url?: Array<{ loc?: string }> | { loc?: string } };
    sitemapindex?: { sitemap?: Array<{ loc?: string }> | { loc?: string } };
  };

  if (parsed.urlset?.url) {
    const entries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    return entries.map((entry) => entry.loc).filter((loc): loc is string => !!loc);
  }

  if (parsed.sitemapindex?.sitemap) {
    const entries = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];
    return entries.map((entry) => entry.loc).filter((loc): loc is string => !!loc);
  }

  return [];
}

export function stableSample<T>(items: T[], requested: number): T[] {
  if (requested <= 0 || items.length <= requested) return [...items];
  if (requested === 1) return [items[0]];

  const result: T[] = [];
  const step = (items.length - 1) / (requested - 1);
  const used = new Set<number>();

  for (let i = 0; i < requested; i++) {
    let index = Math.round(i * step);
    while (used.has(index) && index < items.length - 1) index++;
    while (used.has(index) && index > 0) index--;
    used.add(index);
    result.push(items[index]);
  }

  return result;
}

export function headerValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === lower);
  return found?.[1];
}
