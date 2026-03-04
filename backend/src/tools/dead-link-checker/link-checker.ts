import * as cheerio from 'cheerio';
import type { LinkCheckResult, LinkStatus, DeadLinkResult } from './types.js';

const SKIP_SCHEMES = new Set(['mailto:', 'tel:', 'javascript:', 'data:']);

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

interface RawLink {
  href: string;
  text: string;
  rawHref: string;
}

export async function fetchPageHtml(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DeadLinkChecker/1.0' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching page`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export function extractLinks(html: string, baseUrl: string): RawLink[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const seen = new Map<string, RawLink>();

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href')?.trim() ?? '';
    if (!rawHref || rawHref === '#') return;

    // Check skip schemes
    for (const scheme of SKIP_SCHEMES) {
      if (rawHref.startsWith(scheme)) return;
    }

    // Skip pure fragment links
    if (rawHref.startsWith('#')) return;

    let resolvedUrl: URL;
    try {
      resolvedUrl = new URL(rawHref, base);
    } catch {
      return;
    }

    // Remove fragment for dedup key
    resolvedUrl.hash = '';
    const key = resolvedUrl.toString();

    if (!seen.has(key)) {
      const text = $(el).text().trim();
      seen.set(key, { href: key, text, rawHref });
    }
  });

  return Array.from(seen.values());
}

export async function checkLink(
  link: RawLink,
  baseHostname: string,
  options: { timeoutMs: number; checkExternal: boolean }
): Promise<LinkCheckResult> {
  const isExternal = new URL(link.href).hostname !== baseHostname;
  const start = Date.now();

  if (!options.checkExternal && isExternal) {
    return {
      url: link.href,
      text: link.text,
      rawHref: link.rawHref,
      status: 'skipped',
      statusCode: null,
      isExternal,
      durationMs: 0,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    let response = await fetch(link.href, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: BROWSER_HEADERS,
    });

    // Fallback from HEAD to GET on 405, or on 400/403 for external links (anti-bot protection)
    const retryWithGet = response.status === 405 ||
      (isExternal && (response.status === 403 || response.status === 400));
    if (retryWithGet) {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), options.timeoutMs);
      try {
        response = await fetch(link.href, {
          method: 'GET',
          signal: controller2.signal,
          redirect: 'follow',
          headers: BROWSER_HEADERS,
        });
      } finally {
        clearTimeout(timer2);
      }
    }

    const durationMs = Date.now() - start;
    const statusCode = response.status;
    let status: LinkStatus;
    if (statusCode < 400) {
      status = 'alive';
    } else if (isExternal && (statusCode === 403 || statusCode === 400)) {
      status = 'blocked';
    } else {
      status = 'dead';
    }
    const redirectedTo = response.redirected ? response.url : undefined;

    return {
      url: link.href,
      text: link.text,
      rawHref: link.rawHref,
      status,
      statusCode,
      redirectedTo,
      isExternal,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      url: link.href,
      text: link.text,
      rawHref: link.rawHref,
      status: 'error',
      statusCode: null,
      errorMessage: isTimeout ? 'Timeout' : (err instanceof Error ? err.message : String(err)),
      isExternal,
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkLinksWithConcurrency(
  links: RawLink[],
  baseHostname: string,
  options: { timeoutMs: number; checkExternal: boolean; concurrency: number },
  onResult: (result: LinkCheckResult, checked: number, total: number) => void
): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = new Array(links.length);
  let index = 0;
  let completed = 0;
  const total = links.length;

  async function worker() {
    while (true) {
      const i = index++;
      if (i >= total) break;
      const result = await checkLink(links[i], baseHostname, options);
      results[i] = result;
      completed++;
      onResult(result, completed, total);
    }
  }

  const workers = Array.from({ length: Math.min(options.concurrency, total) }, () => worker());
  await Promise.all(workers);

  return results;
}

export async function checkDeadLinks(
  pageUrl: string,
  options: { concurrency: number; timeoutMs: number; checkExternal: boolean },
  onProgress: (event: { step: 'extracting' | 'checking'; checked?: number; total?: number; currentUrl?: string }) => void
): Promise<DeadLinkResult> {
  onProgress({ step: 'extracting' });
  const html = await fetchPageHtml(pageUrl, options.timeoutMs);
  const links = extractLinks(html, pageUrl);
  const baseHostname = new URL(pageUrl).hostname;

  const allResults: LinkCheckResult[] = [];

  await checkLinksWithConcurrency(
    links,
    baseHostname,
    options,
    (result, checked, total) => {
      allResults.push(result);
      onProgress({ step: 'checking', checked, total, currentUrl: result.url });
    }
  );

  const summary = {
    total: allResults.length,
    alive: allResults.filter((r) => r.status === 'alive').length,
    dead: allResults.filter((r) => r.status === 'dead').length,
    blocked: allResults.filter((r) => r.status === 'blocked').length,
    skipped: allResults.filter((r) => r.status === 'skipped').length,
    error: allResults.filter((r) => r.status === 'error').length,
  };

  return {
    pageUrl,
    timestamp: new Date().toISOString(),
    summary,
    links: allResults,
  };
}
