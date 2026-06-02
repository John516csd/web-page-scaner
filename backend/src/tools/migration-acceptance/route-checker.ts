import type { AcceptanceItem, AcceptanceSection, MigrationSourceData, RedirectRule } from './types.js';
import { buildUrl, normalizeUrlForCompare, stableSample } from './http-utils.js';
import { makeItem, makeSection } from './section.js';
import { runAcceptanceHttpCase, type AcceptanceHttpCase, type AcceptanceHttpResult } from './acceptance-http.js';

const CORE_200_PATHS = ['/', '/en', '/pricing', '/en/pricing', '/blog', '/en/blog', '/features', '/contact'];
const NOT_FOUND_PATHS = ['/nonexistent-page-qa-check', '/zz/nonexistent-page-qa-check'];

const PREFIX_TEST_SUFFIX: Record<string, string> = {
  '/article/': 'best-speech-to-text-app',
  '/tool/': 'ai-summary',
  '/en/tool/': 'youtube-video-summarizer',
};

export async function checkRoutes(options: {
  baseUrl: string;
  source: MigrationSourceData;
  sampleSize?: { exactRedirects?: number; goneUrls?: number; noindex?: number };
}): Promise<AcceptanceSection> {
  const items: AcceptanceItem[] = [];

  for (const path of CORE_200_PATHS) {
    const testCase: AcceptanceHttpCase = {
      id: `core-${path}`,
      name: `core page ${path}`,
      url: buildUrl(options.baseUrl, path),
      headers: path === '/' ? { 'Accept-Language': 'ja-JP,ja;q=0.9' } : undefined,
      expectedStatus: 200,
    };
    items.push(await runUrlCase(testCase));
  }

  const exactSample = stableSample(options.source.exactRedirects, options.sampleSize?.exactRedirects ?? 30);
  for (const rule of exactSample) {
    items.push(await checkRedirectRule(options.baseUrl, rule, `exact redirect ${rule.source}`));
  }

  for (const rule of options.source.prefixRedirects) {
    const suffix = PREFIX_TEST_SUFFIX[rule.source] || 'acceptance-check';
    items.push(await checkRedirectRule(
      options.baseUrl,
      { source: `${rule.source}${suffix}`, target: `${rule.target}${suffix}` },
      `prefix redirect ${rule.source}*`
    ));
  }

  for (const rule of options.source.externalRedirects) {
    const testCase: AcceptanceHttpCase = {
      id: `external-${rule.source}`,
      name: `external redirect ${rule.source}`,
      url: buildUrl(options.baseUrl, rule.source),
      expectedStatus: 301,
      expectedRedirectLocation: rule.target,
    };
    items.push(await runUrlCase(testCase));
  }

  const goneSample = stableSample(options.source.goneUrls, options.sampleSize?.goneUrls ?? 30);
  for (const path of goneSample) {
    const testCase: AcceptanceHttpCase = {
      id: `gone-${path}`,
      name: `410 Gone ${path}`,
      url: buildUrl(options.baseUrl, path),
      expectedStatus: 410,
    };
    items.push(await runUrlCase(testCase));
  }

  const noindexSample = stableSample(options.source.noindexPaths, options.sampleSize?.noindex ?? 30);
  for (const path of noindexSample) {
    const testCase: AcceptanceHttpCase = {
      id: `noindex-${path}`,
      name: `noindex ${path}`,
      url: buildUrl(options.baseUrl, path),
      expectedStatus: 200,
      expectedRobotsMeta: 'noindex',
    };
    items.push(await runUrlCase(testCase));
  }

  for (const path of NOT_FOUND_PATHS) {
    const testCase: AcceptanceHttpCase = {
      id: `404-${path}`,
      name: `404 ${path}`,
      url: buildUrl(options.baseUrl, path),
      expectedStatus: 404,
    };
    items.push(await runUrlCase(testCase));
  }

  return makeSection('routes', 'Routes / Redirects / Gone / Noindex', items);
}

async function checkRedirectRule(baseUrl: string, rule: RedirectRule, name: string): Promise<AcceptanceItem> {
  const target = rule.target === '' ? '/' : rule.target;
  const expectedUrl = target.startsWith('http') ? target : buildUrl(baseUrl, target);
  const testCase: AcceptanceHttpCase = {
    id: `redirect-${rule.source}`,
    name,
    url: buildUrl(baseUrl, rule.source),
    expectedStatus: 301,
    expectedRedirectLocation: expectedUrl,
    expectedFinalStatusLessThan: 400,
  };
  return await runUrlCase(testCase);
}

async function runUrlCase(testCase: AcceptanceHttpCase): Promise<AcceptanceItem> {
  const result = await runAcceptanceHttpCase(testCase);
  return resultToItem(result);
}

function resultToItem(result: AcceptanceHttpResult): AcceptanceItem {
  return makeItem({
    id: result.id,
    name: result.name,
    url: result.url,
    status: result.status,
    expected: result.expected,
    actual: result.actual,
    durationMs: result.durationMs,
    failureReason: result.failureReason,
    responseHeaders: result.responseHeaders,
  });
}
