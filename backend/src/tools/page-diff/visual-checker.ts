import { getBrowser } from '../../shared/browser.js';
import { compareImages } from './image-diff.js';
import type { VisualCheckResult, VisualViewportResult, DiffOptions } from './types.js';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 },
} as const;

async function takeScreenshot(
  url: string,
  viewport: { width: number; height: number },
  options: DiffOptions = {}
): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    await page.evaluate(() => document.fonts.ready);

    if (options.disableAnimations !== false) {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `,
      });
    }

    if (options.hideSelectors?.length) {
      for (const selector of options.hideSelectors) {
        await page.addStyleTag({
          content: `${selector} { visibility: hidden !important; }`,
        });
      }
    }

    // Scroll to bottom to trigger lazy-loaded images, then back to top
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });

    if (options.waitTime && options.waitTime > 0) {
      await page.waitForTimeout(options.waitTime);
    }

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
