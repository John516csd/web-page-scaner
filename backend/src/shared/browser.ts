import { chromium, type Browser } from 'playwright';

let browserInstance: Browser | null = null;
let launchPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browserInstance?.isConnected()) {
    return browserInstance;
  }

  if (launchPromise) {
    return launchPromise;
  }

  launchPromise = chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    browserInstance = await launchPromise;
    return browserInstance;
  } finally {
    launchPromise = null;
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
