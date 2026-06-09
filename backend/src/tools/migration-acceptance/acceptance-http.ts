import * as cheerio from 'cheerio';
import type { AcceptanceStatus } from './types.js';

export interface HeaderExpectation {
  name: string;
  value?: string;
  contains?: string;
  matches?: string;
  final?: boolean;
}

export interface AcceptanceHttpCase {
  id: string;
  name: string;
  url: string;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  expectedStatus?: number;
  expectedFinalStatus?: number;
  expectedFinalStatusLessThan?: number;
  expectedRedirectLocation?: string;
  expectedHeaders?: HeaderExpectation[];
  expectedBodyIncludes?: string[];
  expectedBodyExcludes?: string[];
  expectedRobotsMeta?: string;
  maxRedirects?: number;
}

export interface RedirectHop {
  url: string;
  status: number;
  location: string;
}

export interface AcceptanceHttpResult {
  id: string;
  name: string;
  url: string;
  status: AcceptanceStatus;
  actualStatus: number;
  finalStatus?: number;
  actualLocation?: string;
  redirectChain: RedirectHop[];
  responseHeaders: Record<string, string>;
  finalHeaders?: Record<string, string>;
  expected: string;
  actual: string;
  durationMs: number;
  failureReason?: string;
}

const MAX_CHAIN_DEPTH = 10;

export async function runAcceptanceHttpCase(testCase: AcceptanceHttpCase): Promise<AcceptanceHttpResult> {
  const start = Date.now();
  try {
    const first = await fetchManual(testCase.url, testCase.method || 'GET', testCase.headers || {});
    const redirectChain: RedirectHop[] = [];
    let current = first;

    for (let i = 0; i < MAX_CHAIN_DEPTH && isRedirectStatus(current.status) && current.location; i++) {
      const nextUrl = normalizeUrl(current.location, current.url);
      redirectChain.push({ url: current.url, status: current.status, location: nextUrl });
      current = await fetchManual(nextUrl, testCase.method || 'GET', testCase.headers || {});
    }

    const target = redirectChain.length > 0 ? current : first;
    const expected = expectedText(testCase);
    const actual = [
      `status ${first.status}`,
      first.location ? `Location ${normalizeUrl(first.location, testCase.url)}` : undefined,
      `redirects=${redirectChain.length}`,
      target.status !== first.status || redirectChain.length > 0 ? `final=${target.status}` : undefined,
    ].filter(Boolean).join(', ');

    const failureReason = await getFailureReason(testCase, first, target, redirectChain);

    return {
      id: testCase.id,
      name: testCase.name,
      url: testCase.url,
      status: failureReason ? 'fail' : 'pass',
      actualStatus: first.status,
      finalStatus: target.status,
      actualLocation: first.location,
      redirectChain,
      responseHeaders: first.headers,
      finalHeaders: target.headers,
      expected,
      actual,
      durationMs: Date.now() - start,
      failureReason,
    };
  } catch (error) {
    return {
      id: testCase.id,
      name: testCase.name,
      url: testCase.url,
      status: 'fail',
      actualStatus: 0,
      redirectChain: [],
      responseHeaders: {},
      expected: expectedText(testCase),
      actual: 'request failed',
      durationMs: Date.now() - start,
      failureReason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchManual(
  url: string,
  method: 'GET' | 'HEAD',
  headers: Record<string, string>
): Promise<{
  url: string;
  status: number;
  location?: string;
  headers: Record<string, string>;
  body: string;
}> {
  const response = await fetch(url, {
    method,
    headers: { 'User-Agent': 'WebPageScanner/1.0', ...headers },
    redirect: 'manual',
  });
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  const body = method === 'HEAD' ? '' : await response.text().catch(() => '');
  return {
    url,
    status: response.status,
    location: response.headers.get('location') || undefined,
    headers: responseHeaders,
    body,
  };
}

async function getFailureReason(
  testCase: AcceptanceHttpCase,
  first: Awaited<ReturnType<typeof fetchManual>>,
  target: Awaited<ReturnType<typeof fetchManual>>,
  redirectChain: RedirectHop[]
): Promise<string | undefined> {
  if (testCase.expectedStatus !== undefined && first.status !== testCase.expectedStatus) {
    return `Expected status ${testCase.expectedStatus}, got ${first.status}`;
  }

  if (testCase.expectedRedirectLocation !== undefined) {
    const expected = normalizeUrl(testCase.expectedRedirectLocation, testCase.url);
    const actual = first.location ? normalizeUrl(first.location, testCase.url) : undefined;
    if (!actual) return `Expected redirect to ${testCase.expectedRedirectLocation}, but no Location header found`;
    if (actual !== expected) return `Expected redirect to ${expected}, got ${actual}`;
  }

  if (testCase.maxRedirects !== undefined && redirectChain.length > testCase.maxRedirects) {
    return `Expected at most ${testCase.maxRedirects} redirects, got ${redirectChain.length}`;
  }

  if (testCase.expectedFinalStatus !== undefined && target.status !== testCase.expectedFinalStatus) {
    return `Expected final status ${testCase.expectedFinalStatus}, got ${target.status}`;
  }

  if (testCase.expectedFinalStatusLessThan !== undefined && target.status >= testCase.expectedFinalStatusLessThan) {
    return `Expected final status < ${testCase.expectedFinalStatusLessThan}, got ${target.status}`;
  }

  const headerFailure = checkExpectedHeaders(testCase.expectedHeaders || [], first.headers, target.headers);
  if (headerFailure) return headerFailure;

  if (testCase.expectedRobotsMeta) {
    const robotsMeta = extractRobotsMeta(target.body);
    if (!robotsMeta) return `Expected robots meta "${testCase.expectedRobotsMeta}", but no <meta name="robots"> found`;
    if (normalizeRobotsMeta(robotsMeta) !== normalizeRobotsMeta(testCase.expectedRobotsMeta)) {
      return `Expected robots meta "${testCase.expectedRobotsMeta}", got "${robotsMeta}"`;
    }
  }

  for (const needle of testCase.expectedBodyIncludes || []) {
    if (!target.body.includes(needle)) return `Expected body to include "${needle}"`;
  }

  for (const needle of testCase.expectedBodyExcludes || []) {
    if (target.body.includes(needle)) return `Expected body to exclude "${needle}"`;
  }

  return undefined;
}

function checkExpectedHeaders(
  expectations: HeaderExpectation[],
  firstHeaders: Record<string, string>,
  finalHeaders: Record<string, string>
): string | undefined {
  for (const expectation of expectations) {
    const headers = expectation.final ? finalHeaders : firstHeaders;
    const actual = headerValue(headers, expectation.name);
    if (actual === undefined) return `Expected header "${expectation.name}" to be present`;
    if (expectation.value !== undefined && actual !== expectation.value) {
      return `Expected header "${expectation.name}" to equal "${expectation.value}", got "${actual}"`;
    }
    if (expectation.contains !== undefined && !actual.includes(expectation.contains)) {
      return `Expected header "${expectation.name}" to contain "${expectation.contains}", got "${actual}"`;
    }
    if (expectation.matches !== undefined && !new RegExp(expectation.matches).test(actual)) {
      return `Expected header "${expectation.name}" to match /${expectation.matches}/, got "${actual}"`;
    }
  }
  return undefined;
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function normalizeUrl(url: string, baseUrl?: string): string {
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

function extractRobotsMeta(html: string): string | undefined {
  const $ = cheerio.load(html);
  return $('meta[name="robots"]').first().attr('content') || undefined;
}

function normalizeRobotsMeta(value: string): string {
  return value
    .toLowerCase()
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

function expectedText(testCase: AcceptanceHttpCase): string {
  return [
    testCase.expectedStatus !== undefined ? `status ${testCase.expectedStatus}` : undefined,
    testCase.expectedRedirectLocation ? `Location ${normalizeUrl(testCase.expectedRedirectLocation, testCase.url)}` : undefined,
    testCase.maxRedirects !== undefined ? `<= ${testCase.maxRedirects} redirects` : undefined,
    testCase.expectedFinalStatus !== undefined ? `final ${testCase.expectedFinalStatus}` : undefined,
    testCase.expectedFinalStatusLessThan !== undefined ? `final < ${testCase.expectedFinalStatusLessThan}` : undefined,
    testCase.expectedHeaders?.length ? 'headers match' : undefined,
    testCase.expectedRobotsMeta ? `robots ${testCase.expectedRobotsMeta}` : undefined,
  ].filter(Boolean).join(', ') || 'request succeeds';
}
