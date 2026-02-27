import * as cheerio from 'cheerio';
import type { SeoCheckResult } from './types.js';

interface SeoData {
  title: string | null;
  description: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  h1: string | null;
  robots: string | null;
  jsonLd: string | null;
  hreflangCount: number;
  hreflangEntries: string[];
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'WebPageScanner/1.0' },
    redirect: 'follow',
  });
  return response.text();
}

function extractSeoData(html: string): SeoData {
  const $ = cheerio.load(html);

  const getMeta = (nameOrProperty: string): string | null => {
    const el =
      $(`meta[name="${nameOrProperty}"]`).attr('content') ||
      $(`meta[property="${nameOrProperty}"]`).attr('content');
    return el || null;
  };

  const hreflangEls = $('link[rel="alternate"][hreflang]');
  const hreflangEntries: string[] = [];
  hreflangEls.each((_, el) => {
    const lang = $(el).attr('hreflang');
    const href = $(el).attr('href');
    if (lang && href) {
      hreflangEntries.push(`${lang}: ${href}`);
    }
  });

  const jsonLdScripts = $('script[type="application/ld+json"]');
  let jsonLd: string | null = null;
  if (jsonLdScripts.length > 0) {
    const text = jsonLdScripts.first().html();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        jsonLd = parsed['@type'] || 'JSON-LD present';
      } catch {
        jsonLd = 'JSON-LD present (parse error)';
      }
    }
  }

  return {
    title: $('title').text().trim() || null,
    description: getMeta('description'),
    canonical: $('link[rel="canonical"]').attr('href') || null,
    ogTitle: getMeta('og:title'),
    ogDescription: getMeta('og:description'),
    ogImage: getMeta('og:image'),
    ogUrl: getMeta('og:url'),
    twitterCard: getMeta('twitter:card'),
    twitterTitle: getMeta('twitter:title'),
    twitterDescription: getMeta('twitter:description'),
    h1: $('h1').first().text().trim() || null,
    robots: getMeta('robots'),
    jsonLd,
    hreflangCount: hreflangEntries.length,
    hreflangEntries,
  };
}

export async function checkSeo(urlA: string, urlB: string): Promise<SeoCheckResult> {
  const [htmlA, htmlB] = await Promise.all([fetchHtml(urlA), fetchHtml(urlB)]);
  const seoA = extractSeoData(htmlA);
  const seoB = extractSeoData(htmlB);

  const fields: { name: string; key: keyof SeoData }[] = [
    { name: 'title', key: 'title' },
    { name: 'description', key: 'description' },
    { name: 'canonical', key: 'canonical' },
    { name: 'og:title', key: 'ogTitle' },
    { name: 'og:description', key: 'ogDescription' },
    { name: 'og:image', key: 'ogImage' },
    { name: 'og:url', key: 'ogUrl' },
    { name: 'twitter:card', key: 'twitterCard' },
    { name: 'twitter:title', key: 'twitterTitle' },
    { name: 'twitter:description', key: 'twitterDescription' },
    { name: 'h1', key: 'h1' },
    { name: 'robots', key: 'robots' },
    { name: 'JSON-LD', key: 'jsonLd' },
  ];

  const items = fields.map(({ name, key }) => {
    const valA = seoA[key];
    const valB = seoB[key];
    return {
      name,
      valueA: valA !== null && valA !== undefined ? String(valA) : null,
      valueB: valB !== null && valB !== undefined ? String(valB) : null,
      match: String(valA ?? '') === String(valB ?? ''),
    };
  });

  items.push({
    name: 'hreflang',
    valueA: `${seoA.hreflangCount} 条`,
    valueB: `${seoB.hreflangCount} 条`,
    match:
      seoA.hreflangCount === seoB.hreflangCount &&
      JSON.stringify(seoA.hreflangEntries) === JSON.stringify(seoB.hreflangEntries),
  });

  return { items };
}
