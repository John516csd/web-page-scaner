import type { AcceptanceItem, AcceptanceSection } from './types.js';
import { runAcceptanceHttpCase, type AcceptanceHttpCase, type AcceptanceHttpResult } from './acceptance-http.js';
import { buildUrl } from './http-utils.js';
import { makeItem, makeSection } from './section.js';

const ONLINE_TOOL_PATHS = [
  '/tools/online-audio-converter',
  '/tools/online-video-converter',
  '/tools/online-vocal-remover',
  '/en/tools/online-audio-converter',
  '/en/tools/online-video-converter',
  '/en/tools/online-vocal-remover',
];

export async function checkHeaders(baseUrl: string): Promise<AcceptanceSection> {
  const items: AcceptanceItem[] = [];

  for (const path of ONLINE_TOOL_PATHS) {
    const testCase: AcceptanceHttpCase = {
      id: `coop-coep-${path}`,
      name: `COOP/COEP ${path}`,
      url: buildUrl(baseUrl, path),
      expectedStatus: 200,
      expectedHeaders: [
        { name: 'cross-origin-embedder-policy', value: 'require-corp' },
        { name: 'cross-origin-opener-policy', value: 'same-origin' },
      ],
    };
    items.push(resultToItem(await runAcceptanceHttpCase(testCase)));
  }

  for (const path of ['/llms.txt', '/llms-full.txt']) {
    const testCase: AcceptanceHttpCase = {
      id: `text-plain-${path}`,
      name: `text/plain ${path}`,
      url: buildUrl(baseUrl, path),
      expectedStatus: 200,
      expectedHeaders: [{ name: 'content-type', contains: 'text/plain' }],
    };
    items.push(resultToItem(await runAcceptanceHttpCase(testCase)));
  }

  return makeSection('headers', 'Headers', items);
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
