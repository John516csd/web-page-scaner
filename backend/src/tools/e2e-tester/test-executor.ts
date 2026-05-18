import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import { getBrowser } from '../../shared/browser.js';
import type { E2ETestCase, E2ETestResult } from './types.js';

const APP_ERROR_PATTERN = /error|failed|失败|错误/i;

function createE2EHelpers(page: Page) {
  const dismissCookiebot = async () => {
    try {
      const accept = page
        .locator(
          '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept'
        )
        .first();
      if (await accept.isVisible({ timeout: 3000 })) {
        await accept.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // Cookiebot not present
    }
  };

  const waitForAppError = (timeout: number) =>
    page
      .waitForFunction(
        ({ patternSource }) => {
          const pattern = new RegExp(patternSource, 'i');
          const isExcluded = (el: Element | null) =>
            !!el?.closest('[id*="Cookiebot"], [class*="CybotCookiebot"]');
          const selectors =
            '.ant-message-error, .ant-notification-notice-error, .ant-form-item-explain-error, [role="alert"]';
          for (const el of document.querySelectorAll(selectors)) {
            if (isExcluded(el)) continue;
            const text = el.textContent || '';
            if (!pattern.test(text)) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) return true;
          }
          return false;
        },
        { patternSource: APP_ERROR_PATTERN.source },
        { timeout }
      )
      .then(() => 'error' as const);

  const getAppErrorText = () =>
    page.evaluate(({ patternSource }) => {
      const pattern = new RegExp(patternSource, 'i');
      const isExcluded = (el: Element | null) =>
        !!el?.closest('[id*="Cookiebot"], [class*="CybotCookiebot"]');
      const selectors =
        '.ant-message-error, .ant-notification-notice-error, .ant-form-item-explain-error, [role="alert"]';
      for (const el of document.querySelectorAll(selectors)) {
        if (isExcluded(el)) continue;
        const text = (el.textContent || '').trim();
        if (pattern.test(text)) return text;
      }
      return '';
    }, { patternSource: APP_ERROR_PATTERN.source });

  return { dismissCookiebot, waitForAppError, getAppErrorText };
}

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
  const screenshots: Array<{
    step: string;
    stepNumber?: number;
    timestamp: number;
    duration?: number;
    image: string;
    url?: string;
    selector?: string;
    status?: 'success' | 'warning' | 'error';
    metadata?: {
      elementText?: string;
      networkRequest?: string;
      consoleMessage?: string;
    };
  }> = [];

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ...(testCase.locale ? { locale: testCase.locale } : {}),
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  let lastCaptureTime = startTime;
  let stepCounter = 0;

  const captureScreenshot = async (
    stepDescription: string,
    options?: {
      selector?: string;
      status?: 'success' | 'warning' | 'error';
      metadata?: {
        elementText?: string;
        networkRequest?: string;
        consoleMessage?: string;
      };
    }
  ) => {
    try {
      const now = Date.now();
      const buf = await page.screenshot({ type: 'png' });
      stepCounter++;

      screenshots.push({
        step: stepDescription,
        stepNumber: stepCounter,
        timestamp: now - startTime,
        duration: now - lastCaptureTime,
        image: buf.toString('base64'),
        url: page.url(),
        selector: options?.selector,
        status: options?.status || 'success',
        metadata: options?.metadata,
      });

      lastCaptureTime = now;
    } catch (err) {
      consoleLogs.push(`[warn] Failed to capture screenshot for step: ${stepDescription}`);
    }
  };

  try {
    await page.goto(testCase.url, {
      waitUntil: 'domcontentloaded',
      timeout: testCase.timeout || 60000,
    });

    const assert = createAssert();
    const { dismissCookiebot, waitForAppError, getAppErrorText } =
      createE2EHelpers(page);
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction(
      'page',
      'url',
      'assert',
      '__assets',
      'capture',
      'dismissCookiebot',
      'waitForAppError',
      'getAppErrorText',
      testCase.script
    );
    await Promise.race([
      fn(
        page,
        testCase.url,
        assert,
        ASSETS_DIR,
        captureScreenshot,
        dismissCookiebot,
        waitForAppError,
        getAppErrorText
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Script timed out after ${testCase.timeout || 60000}ms`)), testCase.timeout || 60000)
      ),
    ]);

    return {
      testCase,
      passed: true,
      durationMs: Date.now() - startTime,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
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
      screenshots: screenshots.length > 0 ? screenshots : undefined,
      consoleLogs: consoleLogs.length > 0 ? consoleLogs : undefined,
    };
  } finally {
    await context.close();
  }
}
