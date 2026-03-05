import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { RedirectTestCase, RedirectTestResult } from './types.js';

export async function executeTest(
  testCase: RedirectTestCase,
  proxyUrl?: string
): Promise<RedirectTestResult> {
  const start = Date.now();

  try {
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

    const actualStatus = response.status;
    const locationHeader = response.headers.get('location') || undefined;
    const durationMs = Date.now() - start;

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const result: RedirectTestResult = {
      testCase,
      actualStatus,
      actualRedirectUrl: locationHeader,
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

    return result;
  } catch (err) {
    return {
      testCase,
      actualStatus: 0,
      passed: false,
      failureReason: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Date.now() - start,
    };
  }
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
