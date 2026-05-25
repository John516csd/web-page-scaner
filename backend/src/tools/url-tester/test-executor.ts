import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { UrlTestCase, UrlTestResult } from './types.js';

const REQUEST_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 750];

export async function executeTest(
  testCase: UrlTestCase,
  proxyUrl?: string
): Promise<UrlTestResult> {
  const start = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt++) {
    try {
      return await executeTestAttempt(testCase, proxyUrl, start);
    } catch (err) {
      lastError = err;

      if (attempt === REQUEST_ATTEMPTS) {
        break;
      }

      await delay(RETRY_DELAYS_MS[attempt - 1] ?? 1000);
    }
  }

  return {
    testCase,
    actualStatus: 0,
    passed: false,
    failureReason: `Request failed after ${REQUEST_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
    durationMs: Date.now() - start,
  };
}

async function executeTestAttempt(
  testCase: UrlTestCase,
  proxyUrl: string | undefined,
  start: number
): Promise<UrlTestResult> {
  const headers: Record<string, string> = {
    ...testCase.headers,
  };

  if (testCase.cookies && Object.keys(testCase.cookies).length > 0) {
    const cookieStr = Object.entries(testCase.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    headers['Cookie'] = cookieStr;
  }

  const fetchOptions: Parameters<typeof undiciFetch>[1] = {
    method: testCase.method || 'GET',
    headers,
    redirect: 'manual',
  };

  if (proxyUrl) {
    fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
  }

  const response = await undiciFetch(testCase.url, fetchOptions);
  let bodyRead = false;

  try {
    const actualStatus = response.status;
    const locationHeader = response.headers.get('location') || undefined;

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let actualRobotsMeta: string | undefined;
    if (testCase.expectedRobotsMeta && actualStatus === 200) {
      try {
        const html = await response.text();
        bodyRead = true;
        actualRobotsMeta = extractRobotsMeta(html);
      } catch {
        // ignore body read errors
      }
    }

    const durationMs = Date.now() - start;

    const result: UrlTestResult = {
      testCase,
      actualStatus,
      actualRedirectUrl: locationHeader,
      actualRobotsMeta,
      responseHeaders,
      passed: true,
      durationMs,
    };

    if (actualStatus !== testCase.expectedStatus) {
      result.passed = false;
      result.failureReason = `Expected status ${testCase.expectedStatus}, got ${actualStatus}`;
    }

    if (testCase.expectedRedirectUrl) {
      const baseUrl = new URL(testCase.url).origin;
      const normalizedExpected = normalizeUrl(testCase.expectedRedirectUrl, baseUrl);
      const normalizedActual = locationHeader ? normalizeUrl(locationHeader, baseUrl) : undefined;

      if (!normalizedActual) {
        result.passed = false;
        result.failureReason = `Expected redirect to ${testCase.expectedRedirectUrl}, but no Location header found`;
      } else if (normalizedExpected !== normalizedActual) {
        result.passed = false;
        result.failureReason = `Expected redirect to ${testCase.expectedRedirectUrl}, got ${locationHeader}`;
      }
    }

    if (result.passed && testCase.expectedRobotsMeta) {
      const normalizedExpected = normalizeRobotsMeta(testCase.expectedRobotsMeta);
      const normalizedActual = actualRobotsMeta ? normalizeRobotsMeta(actualRobotsMeta) : undefined;
      if (!normalizedActual) {
        result.passed = false;
        result.failureReason = `Expected robots meta "${testCase.expectedRobotsMeta}", but no <meta name="robots"> found`;
      } else if (normalizedActual !== normalizedExpected) {
        result.passed = false;
        result.failureReason = `Expected robots meta "${testCase.expectedRobotsMeta}", got "${actualRobotsMeta}"`;
      }
    }

    return result;
  } finally {
    if (!bodyRead) {
      await response.body?.cancel().catch(() => {});
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRobotsMeta(html: string): string | undefined {
  const re = /<meta\s+[^>]*name\s*=\s*["']robots["'][^>]*>/gi;
  const matches = html.match(re);
  if (!matches || matches.length === 0) return undefined;
  const tag = matches[0];
  const contentMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
  return contentMatch ? contentMatch[1] : undefined;
}

function normalizeRobotsMeta(value: string): string {
  return value
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .sort()
    .join(',');
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
