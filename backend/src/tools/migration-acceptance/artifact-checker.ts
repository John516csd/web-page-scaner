import { fetchSitemapUrls } from '../../shared/sitemap.js';
import type { AcceptanceEnv, AcceptanceSection } from './types.js';
import { makeItem, makeSection } from './section.js';
import {
  buildUrl,
  extractLocsFromSitemapXml,
  fetchTextManual,
  headerValue,
  INDEXNOW_KEY,
  parseXml,
} from './http-utils.js';

export async function checkArtifacts(options: {
  env: AcceptanceEnv;
  baseUrl: string;
  productionUrl: string;
  minSitemapUrls?: number;
}): Promise<AcceptanceSection> {
  const minSitemapUrls = options.minSitemapUrls ?? 100;
  const items = [];

  const robotsUrl = buildUrl(options.baseUrl, '/robots.txt');
  const robots = await fetchTextManual(robotsUrl);
  const robotsLower = robots.body.toLowerCase();
  if (options.env === 'test') {
    const blocksIndexing = /disallow:\s*\/(?:\s|$)/i.test(robots.body);
    items.push(makeItem({
      id: 'robots-test-noindex',
      name: 'test robots blocks indexing',
      url: robotsUrl,
      status: robots.status === 200 && blocksIndexing ? 'pass' : 'fail',
      expected: '200 and Disallow: /',
      actual: `${robots.status}, ${blocksIndexing ? 'blocks indexing' : 'does not block indexing'}`,
      durationMs: robots.durationMs,
      failureReason: blocksIndexing ? undefined : 'test robots.txt must block indexing',
      responseHeaders: robots.headers,
    }));
    const leaksProductionSitemap = robots.body.includes(options.productionUrl);
    items.push(makeItem({
      id: 'robots-test-production-sitemap',
      name: 'test robots does not expose production sitemap',
      url: robotsUrl,
      status: !leaksProductionSitemap ? 'pass' : 'fail',
      expected: `no ${options.productionUrl} sitemap`,
      actual: leaksProductionSitemap ? 'production sitemap found' : 'production sitemap absent',
      durationMs: robots.durationMs,
      failureReason: leaksProductionSitemap ? 'test robots.txt exposes production sitemap' : undefined,
      responseHeaders: robots.headers,
    }));
  } else {
    const blocksAll = /disallow:\s*\/(?:\s|$)/i.test(robots.body);
    const hasProductionSitemap = robots.body.includes(`${options.productionUrl.replace(/\/$/, '')}/sitemap-0.xml`);
    items.push(makeItem({
      id: 'robots-production',
      name: 'production robots allows indexing and includes sitemap',
      url: robotsUrl,
      status: robots.status === 200 && !blocksAll && hasProductionSitemap ? 'pass' : 'fail',
      expected: '200, no Disallow: /, production sitemap present',
      actual: `${robots.status}, ${blocksAll ? 'Disallow: / present' : 'indexing allowed'}, ${hasProductionSitemap ? 'sitemap present' : 'sitemap missing'}`,
      durationMs: robots.durationMs,
      failureReason: blocksAll || !hasProductionSitemap ? 'production robots.txt does not meet indexing policy' : undefined,
      responseHeaders: robots.headers,
    }));
  }

  const sitemapUrl = buildUrl(options.baseUrl, '/sitemap-0.xml');
  const sitemap = await fetchTextManual(sitemapUrl);
  let sitemapLocs: string[] = [];
  let xmlValid = false;
  let sitemapError: string | undefined;
  try {
    parseXml(sitemap.body);
    xmlValid = true;
    sitemapLocs = await fetchSitemapUrls(sitemapUrl);
    if (sitemapLocs.length === 0) {
      sitemapLocs = extractLocsFromSitemapXml(sitemap.body);
    }
  } catch (error) {
    sitemapError = error instanceof Error ? error.message : String(error);
  }
  const sitemapUsesProductionDomain =
    options.env !== 'production' ||
    sitemapLocs.every((loc) => loc.startsWith(options.productionUrl.replace(/\/$/, '')));
  items.push(makeItem({
    id: 'sitemap',
    name: 'sitemap-0.xml is valid and has expected URLs',
    url: sitemapUrl,
    status:
      sitemap.status === 200 &&
      xmlValid &&
      sitemapLocs.length >= minSitemapUrls &&
      sitemapUsesProductionDomain
        ? 'pass'
        : 'fail',
    expected: `200, valid XML, >= ${minSitemapUrls} URLs${options.env === 'production' ? ', production URL domain' : ''}`,
    actual: `${sitemap.status}, ${xmlValid ? 'valid XML' : 'invalid XML'}, ${sitemapLocs.length} URLs`,
    durationMs: sitemap.durationMs,
    failureReason:
      sitemap.status !== 200
        ? `sitemap-0.xml returned ${sitemap.status}`
        : !xmlValid
          ? `Invalid XML: ${sitemapError}`
          : sitemapLocs.length < minSitemapUrls
            ? `Expected at least ${minSitemapUrls} URLs, got ${sitemapLocs.length}`
            : !sitemapUsesProductionDomain
              ? 'production sitemap contains non-production URLs'
              : undefined,
    responseHeaders: sitemap.headers,
  }));

  const legacySitemapUrl = buildUrl(options.baseUrl, '/sitemap.xml');
  const legacySitemap = await fetchTextManual(legacySitemapUrl);
  const legacyStatus =
    legacySitemap.status === 301 && legacySitemap.location?.includes('/sitemap-0.xml')
      ? 'pass'
      : legacySitemap.status >= 500
        ? 'fail'
        : 'warn';
  items.push(makeItem({
    id: 'sitemap-xml-compat',
    name: 'sitemap.xml compatibility redirect',
    url: legacySitemapUrl,
    status: legacyStatus,
    expected: '301 to /sitemap-0.xml; never 5xx',
    actual: `${legacySitemap.status}${legacySitemap.location ? ` -> ${legacySitemap.location}` : ''}`,
    durationMs: legacySitemap.durationMs,
    failureReason: legacyStatus === 'fail' ? 'sitemap.xml returned 5xx' : undefined,
    responseHeaders: legacySitemap.headers,
  }));

  for (const path of ['/llms.txt', '/llms-full.txt']) {
    const url = buildUrl(options.baseUrl, path);
    const response = await fetchTextManual(url);
    const contentType = headerValue(response.headers, 'content-type') || '';
    const ok = response.status === 200 && contentType.toLowerCase().includes('text/plain');
    items.push(makeItem({
      id: path.slice(1),
      name: `${path} is text/plain`,
      url,
      status: ok ? 'pass' : 'fail',
      expected: '200 and Content-Type includes text/plain',
      actual: `${response.status}, ${contentType || '(missing content-type)'}`,
      durationMs: response.durationMs,
      failureReason: ok ? undefined : `${path} must be served as text/plain`,
      responseHeaders: response.headers,
    }));
  }

  if (options.env === 'production') {
    const keyUrl = buildUrl(options.baseUrl, `/${INDEXNOW_KEY}.txt`);
    const response = await fetchTextManual(keyUrl);
    const ok = response.status === 200 && response.body.includes(INDEXNOW_KEY);
    items.push(makeItem({
      id: 'indexnow-key',
      name: 'IndexNow key file',
      url: keyUrl,
      status: ok ? 'pass' : 'fail',
      expected: `200 and body contains ${INDEXNOW_KEY}`,
      actual: `${response.status}, ${response.body.trim().slice(0, 80) || '(empty)'}`,
      durationMs: response.durationMs,
      failureReason: ok ? undefined : 'IndexNow key file is missing or invalid',
      responseHeaders: response.headers,
    }));
  }

  return makeSection('artifacts', 'SEO Artifacts', items);
}
