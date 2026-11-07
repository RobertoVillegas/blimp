import path from 'node:path';
import { chromium, expect, test as base, type BrowserContext, type Page, type Worker } from '@playwright/test';
export { expect };
import { startFixtureServer } from './fixture-server';

// Callbacks passed to `sw.evaluate` run inside the extension's service worker.
declare global {
  const chrome: typeof browser;
}

export const EXTENSION = path.resolve(import.meta.dirname, '../.output/chrome-mv3-e2e');

type Fixtures = {
  server: Awaited<ReturnType<typeof startFixtureServer>>;
  context: BrowserContext;
  sw: Worker;
};

export const test = base.extend<Fixtures>({
  server: async ({}, use) => {
    const server = await startFixtureServer();
    await use(server);
    await server.close();
  },
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(sw);
  },
});

export async function configureMockProvider(sw: Worker, origin: string, model = 'mock', extra: Record<string, unknown> = {}) {
  await sw.evaluate(
    async ({ baseUrl, model, extra }) => {
      await chrome.storage.local.set({
        settings: {
          activeProfileId: 'local',
          profiles: [
            { id: 'local', preset: 'custom', name: 'Local mock', model, baseUrl },
            { id: 'local-b', preset: 'custom', name: 'Second mock', model: 'mock-b', baseUrl },
          ],
          ...extra,
        },
      });
    },
    { baseUrl: `${origin}/v1`, model, extra },
  );
}

/** Open pages in one window; returns them in tab order. Closes the blank start tab. */
export async function openPages(context: BrowserContext, origin: string, slugs: string[]): Promise<Page[]> {
  const blank = context.pages();
  const pages: Page[] = [];
  for (const slug of slugs) {
    const page = await context.newPage();
    await page.goto(`${origin}/page/${slug}`);
    pages.push(page);
  }
  for (const page of blank) await page.close();
  return pages;
}

/** Same path the toolbar/⌘K handler takes: inject the overlay script, then toggle it. */
export async function openPalette(sw: Worker, page: Page) {
  await page.bringToFront();
  await sw.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    try {
      await chrome.tabs.sendMessage(tab!.id!, { type: 'palette/toggle' });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab!.id! }, files: ['/content-scripts/overlay.js'] });
      await chrome.tabs.sendMessage(tab!.id!, { type: 'palette/toggle' });
    }
  }, page.url());
  const input = page.getByRole('combobox', { name: 'Search commands and tabs' });
  await expect(input).toBeFocused();
  return input;
}

