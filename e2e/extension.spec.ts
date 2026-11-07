import path from 'node:path';
import { chromium, expect, test as base, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { startFixtureServer } from './fixture-server';

// Callbacks passed to `sw.evaluate` run inside the extension's service worker.
declare const chrome: typeof browser;

const EXTENSION = path.resolve(import.meta.dirname, '../.output/chrome-mv3-e2e');

type Fixtures = {
  server: Awaited<ReturnType<typeof startFixtureServer>>;
  context: BrowserContext;
  sw: Worker;
};

const test = base.extend<Fixtures>({
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

async function configureMockProvider(sw: Worker, origin: string, model = 'mock') {
  await sw.evaluate(
    async ({ baseUrl, model }) => {
      await chrome.storage.local.set({
        settings: { provider: 'custom', providers: { custom: { model, baseUrl } } },
      });
    },
    { baseUrl: `${origin}/v1`, model },
  );
}

/** Open pages in one window; returns them in tab order. Closes the blank start tab. */
async function openPages(context: BrowserContext, origin: string, slugs: string[]): Promise<Page[]> {
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
async function openPalette(sw: Worker, page: Page) {
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

async function windowState(sw: Worker) {
  return sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groups = await chrome.tabGroups.query({});
    return {
      order: tabs.map((tab) => tab.title),
      pinned: tabs.filter((tab) => tab.pinned).map((tab) => tab.title),
      groups: groups
        .map((group) => ({
          title: group.title,
          color: group.color,
          tabs: tabs.filter((tab) => tab.groupId === group.id).map((tab) => tab.title).sort(),
        }))
        .sort((a, b) => a.title!.localeCompare(b.title!)),
    };
  });
}

test('palette opens, filters commands and tabs without AI, closes on Esc', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [first, second] = await openPages(context, server.origin, ['react-hooks', 'weather-paris']);

  const input = await openPalette(sw, first!);
  await expect(first!.getByRole('option', { name: 'Tidy Tabs Command', exact: true })).toBeVisible();
  await expect(first!.getByText('Custom (OpenAI-compatible) · mock')).toBeVisible();

  await input.fill('paris');
  await expect(first!.getByRole('option')).toHaveCount(1);
  await input.press('Enter');
  await expect.poll(() => second!.evaluate(() => document.visibilityState)).toBe('visible');

  const again = await openPalette(sw, first!);
  await again.press('Escape');
  await expect(again).toBeHidden();
  expect(server.requests).toHaveLength(0);
});

test('Tidy Tabs groups only on request, keeps pinned tabs and existing groups, and undoes', async ({
  context,
  sw,
  server,
}) => {
  await configureMockProvider(sw, server.origin);
  const pages = await openPages(context, server.origin, [
    'news-a',
    'react-hooks',
    'weather-madrid',
    'recipe-pasta',
    'react-state',
    'weather-paris',
    'recipe-tacos',
    'news-b',
  ]);
  // A pinned tab and a user-made group that Tidy Tabs must leave alone.
  await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    await chrome.tabs.update(tabs.find((t) => t.title === 'Local news A')!.id!, { pinned: true });
    const groupId = await chrome.tabs.group({ tabIds: [tabs.find((t) => t.title === 'Local news B')!.id!] });
    await chrome.tabGroups.update(groupId, { title: 'Mine', color: 'pink' });
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  expect(server.requests).toHaveLength(0);
  const before = await windowState(sw);

  const input = await openPalette(sw, pages[1]!);
  await input.fill('tidy');
  await input.press('Enter');
  await expect(pages[1]!.getByText('Tabs tidied')).toBeVisible();

  expect(server.requests).toHaveLength(1);
  expect(server.requests[0]!.user).not.toContain('Local news A');
  expect(server.requests[0]!.user).not.toContain('Local news B');

  const after = await windowState(sw);
  expect(after.groups).toEqual([
    { title: 'Mine', color: 'pink', tabs: ['Local news B'] },
    { title: 'React docs', color: 'blue', tabs: ['Hooks reference – React', 'Managing state – React'] },
    { title: 'Recipes', color: 'orange', tabs: ['Easy pasta recipe', 'Street tacos recipe'] },
    { title: 'Weather', color: 'cyan', tabs: ['Madrid weather forecast', 'Paris weather forecast'] },
  ]);
  expect(after.pinned).toEqual(['Local news A']);
  expect([...after.order].sort()).toEqual([...before.order].sort());

  await pages[1]!.getByRole('button', { name: 'Undo Tidy Tabs' }).click();
  await expect(pages[1]!.getByText('Tidy Tabs undone')).toBeVisible();
  expect(await windowState(sw)).toEqual(before);
});

test('invalid model output changes nothing', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock-bad');
  const pages = await openPages(context, server.origin, ['react-hooks', 'react-state', 'weather-paris']);
  const before = await windowState(sw);

  const input = await openPalette(sw, pages[0]!);
  await input.fill('tidy');
  await input.press('Enter');
  await expect(pages[0]!.getByRole('alert')).toContainText('Nothing was changed');
  expect(await windowState(sw)).toEqual(before);
});

test('Summarize and Ask Page use visible article text only', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['recipe-pasta']);

  const input = await openPalette(sw, page!);
  await input.fill('summarize page');
  await input.press('Enter');
  await expect(page!.getByText('MOCK SUMMARY of "Easy pasta recipe".')).toBeVisible();
  await expect(page!.getByText('point one')).toBeVisible();

  const sent = server.requests[0]!.user;
  expect(sent).toContain('Boil pasta for nine minutes');
  expect(sent).toContain('## Details');
  for (const leaked of ['hunter2-PASSWORD', 'FORM-VALUE', 'HIDDEN-SECRET-TEXT', 'NAVIGATION-CHROME', 'FOOTER-CHROME']) {
    expect(sent).not.toContain(leaked);
  }

  const followUp = page!.getByRole('textbox', { name: 'Question about this page' });
  await followUp.fill('How long do I boil it?');
  await followUp.press('Enter');
  await expect(page!.getByText(/MOCK ANSWER about "Easy pasta recipe" to: How long/)).toBeVisible();
  // The follow-up carries the conversation, with the page only in the first turn.
  const messages = server.requests[1]!.body.messages as { role: string; content: string }[];
  expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  expect(messages[1]!.content).toContain('Boil pasta');

  await page!.getByRole('button', { name: 'Forget this page conversation' }).click();
  const stored = await sw.evaluate(() => chrome.storage.session.get(null));
  expect(Object.keys(stored).filter((key) => key.startsWith('page:'))).toEqual([]);
});

test('popup palette explains that browser pages cannot be read', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const extensionId = new URL(sw.url()).host;
  const page = await context.newPage();
  await page.goto('chrome://version');
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'chrome://version/' }))[0]!.id!);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/palette.html?tabId=${tabId}`);
  const input = popup.getByRole('combobox', { name: 'Search commands and tabs' });
  await input.fill('summarize page');
  await input.press('Enter');
  await expect(popup.getByRole('alert')).toContainText('can only read regular web pages');
  expect(server.requests).toHaveLength(0);
});

test('content scripts cannot read session secrets', async ({ context, sw, server }) => {
  const [page] = await openPages(context, server.origin, ['news-a']);
  const outcome = await sw.evaluate(async (url) => {
    await chrome.storage.session.set({ 'secret:openai': 'sk-session-key' });
    const [tab] = await chrome.tabs.query({ url });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab!.id! },
      func: async () => {
        try {
          return JSON.stringify(await chrome.storage.session.get(null));
        } catch (error) {
          return `blocked: ${(error as Error).message}`;
        }
      },
    });
    return result!.result as string;
  }, page!.url());
  expect(outcome).toMatch(/^blocked:/);
});
