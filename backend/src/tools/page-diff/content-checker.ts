import * as cheerio from 'cheerio';
import type {
  ContentCheckResult,
  ContentHeading,
  ContentLink,
  ContentImage,
  ContentTagCount,
} from './types.js';

interface PageContent {
  tagCounts: Map<string, number>;
  totalElements: number;
  headings: ContentHeading[];
  links: ContentLink[];
  images: ContentImage[];
  textLines: string[];
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'WebPageScanner/1.0' },
    redirect: 'follow',
  });
  return response.text();
}

function extractContent(html: string, baseUrl: string): PageContent {
  const $ = cheerio.load(html);

  // Remove non-visible elements before extracting text
  $('script, style, noscript, svg, template').remove();

  // Tag counts
  const tagCounts = new Map<string, number>();
  let totalElements = 0;
  $('body *').each((_, el) => {
    const tagName = 'tagName' in el ? (el.tagName as string)?.toLowerCase() : undefined;
    if (!tagName) return;
    totalElements++;
    tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
  });

  // Headings
  const headings: ContentHeading[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = 'tagName' in el ? (el.tagName as string)?.toLowerCase() : '';
    const level = parseInt(tag?.replace('h', '') || '0');
    const text = $(el).text().trim();
    if (text) {
      headings.push({ level, text });
    }
  });

  // Links
  const links: ContentLink[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    let resolvedHref = href;
    try {
      resolvedHref = new URL(href, baseUrl).pathname;
    } catch {
      // keep original if can't resolve
    }
    links.push({ href: resolvedHref, text: text.slice(0, 100) });
  });

  // Images
  const images: ContentImage[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    const alt = $(el).attr('alt') || '';
    let resolvedSrc = src;
    try {
      resolvedSrc = new URL(src, baseUrl).pathname;
    } catch {
      // keep original
    }
    images.push({ src: resolvedSrc, alt: alt.slice(0, 200) });
  });

  // Visible text lines
  const bodyText = $('body').text();
  const textLines = bodyText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return { tagCounts, totalElements, headings, links, images, textLines };
}

function dedupe<T>(list: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function diffLists<T>(
  listA: T[],
  listB: T[],
  key: (item: T) => string
): { added: T[]; removed: T[]; common: number } {
  const uniqueA = dedupe(listA, key);
  const uniqueB = dedupe(listB, key);

  const setA = new Set(uniqueA.map(key));
  const setB = new Set(uniqueB.map(key));

  const added = uniqueB.filter((item) => !setA.has(key(item)));
  const removed = uniqueA.filter((item) => !setB.has(key(item)));

  let common = 0;
  for (const k of setA) {
    if (setB.has(k)) common++;
  }

  return { added, removed, common };
}

function computeTextDiff(linesA: string[], linesB: string[]): {
  similarity: number;
  added: string[];
  removed: string[];
} {
  const setA = new Set(linesA);
  const setB = new Set(linesB);

  const added = linesB.filter((line) => !setA.has(line));
  const removed = linesA.filter((line) => !setB.has(line));

  const totalUnique = new Set([...linesA, ...linesB]).size;
  const commonCount = totalUnique - added.length - removed.length;
  const similarity = totalUnique > 0 ? Math.round((commonCount / totalUnique) * 100) : 100;

  // Cap the diff output to avoid huge payloads
  const MAX_DIFF_LINES = 100;

  return {
    similarity,
    added: added.slice(0, MAX_DIFF_LINES),
    removed: removed.slice(0, MAX_DIFF_LINES),
  };
}

export async function checkContent(urlA: string, urlB: string): Promise<ContentCheckResult> {
  const [htmlA, htmlB] = await Promise.all([fetchHtml(urlA), fetchHtml(urlB)]);
  const contentA = extractContent(htmlA, urlA);
  const contentB = extractContent(htmlB, urlB);

  // DOM tag counts — only include tags that differ or are structurally significant
  const allTags = new Set([...contentA.tagCounts.keys(), ...contentB.tagCounts.keys()]);
  const tagCounts: ContentTagCount[] = [];
  for (const tag of [...allTags].sort()) {
    const countA = contentA.tagCounts.get(tag) || 0;
    const countB = contentB.tagCounts.get(tag) || 0;
    tagCounts.push({ tag, countA, countB });
  }

  // Links diff — use href+text as compound key for finer-grained comparison
  const linkKey = (l: ContentLink) => `${l.href}\0${l.text}`;
  const linksDiff = diffLists(contentA.links, contentB.links, linkKey);

  // Images diff — use src+alt as compound key
  const imageKey = (i: ContentImage) => `${i.src}\0${i.alt}`;
  const imagesDiff = diffLists(contentA.images, contentB.images, imageKey);

  // Text diff
  const textDiff = computeTextDiff(contentA.textLines, contentB.textLines);

  return {
    dom: {
      totalA: contentA.totalElements,
      totalB: contentB.totalElements,
      tagCounts,
    },
    headings: {
      listA: contentA.headings,
      listB: contentB.headings,
    },
    links: {
      countA: linksDiff.common + linksDiff.removed.length,
      countB: linksDiff.common + linksDiff.added.length,
      added: linksDiff.added,
      removed: linksDiff.removed,
      common: linksDiff.common,
    },
    images: {
      countA: imagesDiff.common + imagesDiff.removed.length,
      countB: imagesDiff.common + imagesDiff.added.length,
      added: imagesDiff.added,
      removed: imagesDiff.removed,
      common: imagesDiff.common,
    },
    text: textDiff,
  };
}
