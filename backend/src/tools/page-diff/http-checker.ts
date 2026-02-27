import type { HttpCheckResult } from './types.js';

interface FetchMetrics {
  statusCode: number;
  contentType: string;
  ttfb: number;
}

async function fetchWithMetrics(url: string): Promise<FetchMetrics> {
  const start = performance.now();
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'WebPageScanner/1.0',
    },
  });
  const ttfb = Math.round(performance.now() - start);

  return {
    statusCode: response.status,
    contentType: response.headers.get('content-type') || '(none)',
    ttfb,
  };
}

export async function checkHttp(urlA: string, urlB: string): Promise<HttpCheckResult> {
  const [metricsA, metricsB] = await Promise.all([
    fetchWithMetrics(urlA),
    fetchWithMetrics(urlB),
  ]);

  return {
    items: [
      {
        name: 'Status Code',
        valueA: metricsA.statusCode,
        valueB: metricsB.statusCode,
        match: metricsA.statusCode === metricsB.statusCode,
      },
      {
        name: 'Content-Type',
        valueA: metricsA.contentType,
        valueB: metricsB.contentType,
        match: normalizeContentType(metricsA.contentType) ===
               normalizeContentType(metricsB.contentType),
      },
      {
        name: 'TTFB',
        valueA: `${metricsA.ttfb}ms`,
        valueB: `${metricsB.ttfb}ms`,
        match: true,
      },
    ],
  };
}

function normalizeContentType(ct: string): string {
  return ct.split(';')[0].trim().toLowerCase();
}
