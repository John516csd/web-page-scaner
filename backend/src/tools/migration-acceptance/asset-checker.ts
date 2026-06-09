import { getBrowser } from '../../shared/browser.js';
import type { AcceptanceItem, AcceptanceSection, AcceptanceStatus } from './types.js';
import { buildUrl, headerValue } from './http-utils.js';
import { makeItem, makeSection } from './section.js';

const ASSET_PAGE_PATHS = ['/', '/en', '/pricing', '/en/pricing', '/blog', '/en/blog', '/features', '/contact'];
const RESOURCE_TYPES = new Set(['script', 'stylesheet', 'image', 'font']);

export async function checkAssets(baseUrl: string): Promise<AcceptanceSection> {
  const browser = await getBrowser();
  const baseOrigin = new URL(baseUrl).origin;
  const items: AcceptanceItem[] = [];

  for (const path of ASSET_PAGE_PATHS) {
    const url = buildUrl(baseUrl, path);
    const start = Date.now();
    const failures: string[] = [];
    const warnings: string[] = [];
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ...(path === '/' ? { locale: 'ja-JP' } : {}),
    });
    const page = await context.newPage();

    page.on('response', (response) => {
      const request = response.request();
      if (!RESOURCE_TYPES.has(request.resourceType())) return;
      const responseUrl = response.url();
      const sameOrigin = safeOrigin(responseUrl) === baseOrigin;
      const status = response.status();
      const contentType = headerValue(response.headers(), 'content-type') || '';

      if (sameOrigin && status >= 400) {
        failures.push(`${status} ${responseUrl}`);
      }
      if (sameOrigin && request.resourceType() === 'script' && status < 400 && !isJavaScriptMime(contentType)) {
        failures.push(`bad JS MIME ${contentType || '(missing)'} ${responseUrl}`);
      }
      if (sameOrigin && request.resourceType() === 'stylesheet' && status < 400 && !contentType.toLowerCase().includes('text/css')) {
        failures.push(`bad CSS MIME ${contentType || '(missing)'} ${responseUrl}`);
      }
    });

    page.on('requestfailed', (request) => {
      if (!RESOURCE_TYPES.has(request.resourceType())) return;
      const responseUrl = request.url();
      if (safeOrigin(responseUrl) === baseOrigin) {
        failures.push(`request failed ${responseUrl}: ${request.failure()?.errorText || 'unknown'}`);
      } else {
        warnings.push(`third-party blocked ${responseUrl}`);
      }
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    } finally {
      await context.close();
    }

    const status: AcceptanceStatus = failures.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';
    items.push(makeItem({
      id: `assets-${path}`,
      name: `assets ${path}`,
      url,
      status,
      expected: 'same-origin JS/CSS/images/fonts have no 4xx/5xx and correct JS/CSS MIME',
      actual:
        failures.length > 0
          ? failures.slice(0, 5).join('; ')
          : warnings.length > 0
            ? warnings.slice(0, 5).join('; ')
            : 'assets ok',
      durationMs: Date.now() - start,
      failureReason: failures.length > 0 ? failures.slice(0, 5).join('; ') : undefined,
    }));
  }

  return makeSection('assets', 'Static Assets', items);
}

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function isJavaScriptMime(contentType: string): boolean {
  const value = contentType.toLowerCase();
  return (
    value.includes('javascript') ||
    value.includes('ecmascript') ||
    value.includes('application/x-javascript')
  );
}
