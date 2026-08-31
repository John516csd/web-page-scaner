import { getBrowser } from '../../shared/browser.js';
import { compareImages } from './image-diff.js';
import type { VisualCheckResult, VisualViewportResult, DiffOptions } from './types.js';
import type { Page } from 'playwright';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 },
} as const;

const NAVIGATION_TIMEOUT_MS = 30000;
const RENDER_TIMEOUT_MS = 10000;
const LAYOUT_SAMPLE_INTERVAL_MS = 250;
const REQUIRED_STABLE_LAYOUT_SAMPLES = 3;
const DEFAULT_HIDE_SELECTORS = [
  '#CybotCookiebotDialog',
  '#CybotCookiebotDialogBodyUnderlay',
  '.CookieConsent',
  '.cky-consent-container',
  '[data-testid="cookie-banner"]',
];

interface LayoutSnapshot {
  width: number;
  height: number;
  bodyWidth: number;
  bodyHeight: number;
}

function layoutsMatch(previous: LayoutSnapshot, current: LayoutSnapshot): boolean {
  return (
    Math.abs(previous.width - current.width) <= 1 &&
    Math.abs(previous.height - current.height) <= 1 &&
    Math.abs(previous.bodyWidth - current.bodyWidth) <= 1 &&
    Math.abs(previous.bodyHeight - current.bodyHeight) <= 1
  );
}

async function waitForStableLayout(
  page: Page,
  timeoutMs = RENDER_TIMEOUT_MS
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let previous: LayoutSnapshot | undefined;
  let stableSamples = 0;

  while (Date.now() < deadline) {
    const current = await page.evaluate<LayoutSnapshot>(() => {
      const documentElement = document.documentElement;
      const body = document.body;
      return {
        width: documentElement.scrollWidth,
        height: documentElement.scrollHeight,
        bodyWidth: body?.scrollWidth ?? 0,
        bodyHeight: body?.scrollHeight ?? 0,
      };
    });

    if (previous && layoutsMatch(previous, current)) {
      stableSamples += 1;
      if (stableSamples >= REQUIRED_STABLE_LAYOUT_SAMPLES) {
        return;
      }
    } else {
      stableSamples = 0;
    }

    previous = current;
    await page.waitForTimeout(LAYOUT_SAMPLE_INTERVAL_MS);
  }
}

async function waitForFonts(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => !document.fonts || document.fonts.status === 'loaded',
      undefined,
      { timeout: RENDER_TIMEOUT_MS }
    )
    .catch(() => undefined);
}

async function waitForImages(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () =>
        Array.from(document.images)
          .filter((image) => image.currentSrc || image.getAttribute('src'))
          .every((image) => image.complete),
      undefined,
      { timeout: RENDER_TIMEOUT_MS / 2 }
    )
    .catch(() => undefined);

  await page.evaluate(async (timeoutMs) => {
    const decodeImages = Promise.all(
      Array.from(document.images)
        .filter((image) => image.currentSrc || image.getAttribute('src'))
        .map((image) => image.decode().catch(() => undefined))
    );

    await Promise.race([
      decodeImages,
      new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
    ]);
  }, RENDER_TIMEOUT_MS / 2);
}

async function applyDeterministicPageState(
  page: Page,
  options: DiffOptions
): Promise<void> {
  if (options.disableAnimations !== false) {
    await page.addStyleTag({
      content: `
        html { scroll-behavior: auto !important; }
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
        }
      `,
    });
  }

  const selectors = [...DEFAULT_HIDE_SELECTORS, ...(options.hideSelectors ?? [])];
  for (const selector of new Set(selectors)) {
    await page
      .addStyleTag({
        content: `${selector} { visibility: hidden !important; }`,
      })
      .catch(() => undefined);
  }

  await page.evaluate(() => {
    for (const media of document.querySelectorAll<HTMLMediaElement>('video, audio')) {
      media.pause();
      try {
        media.currentTime = 0;
      } catch {
        // Some streaming media does not allow seeking before metadata is available.
      }
    }
  });
}

async function triggerLazyContent(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const maxSteps = 120;

    for (let step = 0; step < maxSteps; step += 1) {
      const documentHeight = document.documentElement.scrollHeight;
      if (window.scrollY + window.innerHeight >= documentHeight) {
        break;
      }

      window.scrollBy(0, Math.max(Math.floor(window.innerHeight * 0.8), 600));
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    }

    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    window.scrollTo(0, 0);
  });
}

async function takeScreenshot(
  url: string,
  viewport: { width: number; height: number },
  options: DiffOptions = {}
): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    bypassCSP: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await page.locator('body').waitFor({ state: 'visible', timeout: RENDER_TIMEOUT_MS });
    await waitForFonts(page);
    await applyDeterministicPageState(page, options);
    await triggerLazyContent(page);
    await waitForImages(page);

    if (options.waitTime && options.waitTime > 0) {
      await page.waitForTimeout(options.waitTime);
    }

    await waitForStableLayout(page);

    const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
    return Buffer.from(screenshot);
  } finally {
    await context.close();
  }
}

export async function checkVisual(
  urlA: string,
  urlB: string,
  options: DiffOptions = {}
): Promise<VisualCheckResult> {
  const viewportNames = options.viewports?.length
    ? options.viewports
    : (['desktop', 'mobile'] as const);

  const viewports: VisualViewportResult[] = [];

  for (const vpName of viewportNames) {
    const vp = VIEWPORTS[vpName];

    const [screenshotA, screenshotB] = await Promise.all([
      takeScreenshot(urlA, vp, options),
      takeScreenshot(urlB, vp, options),
    ]);

    const diff = compareImages(screenshotA, screenshotB);

    viewports.push({
      viewport: vpName,
      screenshotA: screenshotA.toString('base64'),
      screenshotB: screenshotB.toString('base64'),
      diffImage: diff.diffImage.toString('base64'),
      diffPercentage: diff.diffPercentage,
      width: diff.width,
      height: diff.height,
    });
  }

  return { viewports };
}
