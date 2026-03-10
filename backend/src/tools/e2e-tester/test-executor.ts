import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBrowser } from '../../shared/browser.js';
import type { E2ETestCase, E2ETestResult } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../../../data/test-assets');

function createAssert() {
  return function assert(condition: unknown, message?: string): void {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  };
}

export async function executeE2ETest(testCase: E2ETestCase): Promise<E2ETestResult> {
  const startTime = Date.now();
  const consoleLogs: string[] = [];
  let screenshot: string | undefined;

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    await page.goto(testCase.url, {
      waitUntil: 'domcontentloaded',
      timeout: testCase.timeout || 60000,
    });

    const assert = createAssert();
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('page', 'url', 'assert', '__assets', testCase.script);
    await Promise.race([
      fn(page, testCase.url, assert, ASSETS_DIR),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Script timed out after ${testCase.timeout || 60000}ms`)), testCase.timeout || 60000)
      ),
    ]);

    return {
      testCase,
      passed: true,
      durationMs: Date.now() - startTime,
      consoleLogs: consoleLogs.length > 0 ? consoleLogs : undefined,
    };
  } catch (err) {
    try {
      const buf = await page.screenshot({ type: 'png' });
      screenshot = buf.toString('base64');
    } catch {
      // screenshot may fail if page is already closed
    }

    return {
      testCase,
      passed: false,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
      screenshot,
      consoleLogs: consoleLogs.length > 0 ? consoleLogs : undefined,
    };
  } finally {
    await context.close();
  }
}
