import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Page, type Worker } from '@playwright/test';
import { EXTENSION, configureMockProvider, expect, openPages, openPalette, test } from './helpers';
import { startFixtureServer } from './fixture-server';

const visible = (page: Page) => page.evaluate(() => document.visibilityState);

test.describe('Summarize and Ask across tabs', () => {
  test('cites sources, reports skipped tabs, and jumps to a cited tab', async ({ context, sw, server }) => {
    await configureMockProvider(sw, server.origin);
    const pages = await openPages(context, server.origin, ['react-hooks', 'react-state', 'weather-paris']);
    // Not readable: a browser page, and a site the extension has no access to (localhost ≠ 127.0.0.1).
    const internal = await context.newPage();
    await internal.goto('chrome://version');
    const other = await context.newPage();
    await other.goto(server.origin.replace('127.0.0.1', 'localhost') + '/page/news-a');

    const input = await openPalette(sw, pages[0]!);
    await input.fill('summarize tabs');
    await input.press('Enter');

    const internalRow = pages[0]!.getByRole('checkbox', { name: /chrome:\/\/version|About Version/ });
    await expect(internalRow).toBeDisabled();
    await expect(pages[0]!.getByText('Browser or extension page')).toBeVisible();
    expect(server.requests).toHaveLength(0);

    await pages[0]!.getByRole('button', { name: 'Summarize 4 tabs' }).click();
    await expect(pages[0]!.getByText('needs access to read this site')).toBeVisible();
    await expect(pages[0]!.getByText(/^localhost$/)).toBeVisible();
    await pages[0]!.getByRole('button', { name: 'Skip those tabs' }).click();

    await expect(pages[0]!.getByText('CROSS SUMMARY.')).toBeVisible();
    const sources = pages[0]!.locator('.hm-sources li');
    await expect(sources).toHaveText([/Hooks reference/, /Managing state/, /Paris weather/]);
    await expect(pages[0]!.locator('.hm-skipped li')).toHaveText([/Local news A · No access to this site/]);
    // [99] is not a real source, so it stays plain text.
    await expect(pages[0]!.getByText('Ignored citation [99].')).toBeVisible();

    const sent = server.requests[0]!.user;
    expect(sent).toContain('<source n="1">');
    expect(sent).toContain('Light rain expected in Paris');
    expect(sent).not.toContain('hunter2-PASSWORD');
    expect(sent).not.toContain('Local news A');

    await pages[0]!.getByRole('button', { name: 'Source 3: Paris weather forecast' }).click();
    await expect.poll(() => visible(pages[2]!)).toBe('visible');
  });

  test('skips sleeping tabs unless asked to wake them, without switching to them', async ({ context, sw, server }) => {
    await configureMockProvider(sw, server.origin);
    const pages = await openPages(context, server.origin, ['react-hooks', 'weather-paris']);
    await pages[0]!.bringToFront();
    await sw.evaluate(async () => {
      const [paris] = await chrome.tabs.query({ title: 'Paris weather forecast' });
      await chrome.tabs.discard(paris!.id!);
    });

    const input = await openPalette(sw, pages[0]!);
    await input.fill('summarize tabs');
    await input.press('Enter');
    const sleeping = pages[0]!.getByRole('checkbox', { name: /Paris weather forecast/ });
    await expect(sleeping).toBeDisabled();
    await pages[0]!.getByRole('checkbox', { name: /Wake sleeping tabs/ }).check();
    await expect(sleeping).toBeChecked();
    await pages[0]!.getByRole('button', { name: 'Summarize 2 tabs' }).click();

    await expect(pages[0]!.locator('.hm-sources li')).toHaveText([/Hooks reference/, /Paris weather/]);
    expect(server.requests[0]!.user).toContain('Light rain expected in Paris');
    // The palette's tab stayed in front.
    expect(await pages[0]!.evaluate(() => document.visibilityState)).toBe('visible');
  });

  test('asks a question, and uses map/reduce when the tabs exceed the budget', async ({ context, sw, server }) => {
    await configureMockProvider(sw, server.origin, 'mock', { maxInputTokens: 1000 });
    const pages = await openPages(context, server.origin, ['react-hooks', 'react-state', 'weather-paris', 'weather-madrid', 'recipe-pasta']);

    const input = await openPalette(sw, pages[0]!);
    await input.fill('ask across');
    await input.press('Enter');
    const question = pages[0]!.getByRole('textbox', { name: 'Question for the selected tabs' });
    await question.fill('Where is it warmer?');
    await question.press('Enter');

    await expect(pages[0]!.getByText('ANSWER to "Where is it warmer?".')).toBeVisible();
    const maps = server.requests.filter((request) => request.system.startsWith('You take notes'));
    expect(maps.length).toBeGreaterThan(1);
    expect(server.requests.at(-1)!.user).toContain('note from source');
    await expect(pages[0]!.getByText(new RegExp(`read in ${maps.length} batches`))).toBeVisible();
  });
});

test.describe('Shift-hover link previews', () => {
  async function enablePreviews(sw: Worker, origin: string) {
    await configureMockProvider(sw, origin, 'mock', { linkPreviews: true });
    await expect
      .poll(() => sw.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id)))
      .toEqual(['link-preview']);
  }

  const card = (page: Page) => page.locator('helium-max-preview .card');

  test('Shift-hover summarizes a link without opening it; plain hover does nothing', async ({ context, sw, server }) => {
    await enablePreviews(sw, server.origin);
    const page = await context.newPage();
    await page.goto(`${server.origin}/links`);

    await page!.hover('#hooks');
    await page!.waitForTimeout(900);
    await expect(card(page!)).toHaveCount(0);
    expect(server.gets).not.toContain('/page/react-hooks');
    expect(server.requests).toHaveLength(0);

    await page!.keyboard.down('Shift');
    await expect(card(page!)).toContainText('PREVIEW of "Hooks reference – React"');
    await expect(card(page!)).toContainText('127.0.0.1');
    expect(server.gets.filter((p) => p === '/page/react-hooks')).toHaveLength(1);
    expect(server.requests[0]!.user).toContain('useState lets a component remember');
    expect(context.pages().some((p) => p.url().endsWith('/page/react-hooks'))).toBe(false);

    await page!.keyboard.up('Shift');
    await expect(card(page!)).toHaveCount(0);

    // Second time comes from the session cache.
    await page!.hover('#paris');
    await page!.hover('#hooks');
    await page!.keyboard.down('Shift');
    await expect(card(page!)).toContainText('PREVIEW of "Hooks reference – React"');
    expect(server.gets.filter((p) => p === '/page/react-hooks')).toHaveLength(1);
    expect(server.requests).toHaveLength(1);
    await page!.keyboard.press('Escape');
    await expect(card(page!)).toHaveCount(0);
    await page!.keyboard.up('Shift');
  });

  test('shows sign-in pages as unavailable without asking the AI', async ({ context, sw, server }) => {
    await enablePreviews(sw, server.origin);
    const page = await context.newPage();
    await page.goto(`${server.origin}/links`);
    await page.hover('#login');
    await page.keyboard.down('Shift');
    await expect(card(page)).toContainText('Preview unavailable: Looks like a sign-in page.');
    expect(server.requests).toHaveLength(0);
    await page.keyboard.up('Shift');
  });

  test('stays quiet while typing and when turned off', async ({ context, sw, server }) => {
    await enablePreviews(sw, server.origin);
    const page = await context.newPage();
    await page.goto(`${server.origin}/links`);
    await page.click('#box');
    await page.hover('#hooks');
    await page.keyboard.down('Shift');
    await page.keyboard.type('ABC');
    await page.waitForTimeout(900);
    await page.keyboard.up('Shift');
    await expect(card(page)).toHaveCount(0);
    expect(server.gets).not.toContain('/page/react-hooks');

    await configureMockProvider(sw, server.origin, 'mock', { linkPreviews: false });
    await expect.poll(() => sw.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length)).toBe(0);
  });
});

test.describe('Instant Links', () => {
  test('opens the model-ranked result from real search results', async ({ context, sw, server }) => {
    await configureMockProvider(sw, server.origin, 'mock', { search: { provider: 'searxng', baseUrl: `${server.origin}/searx` } });
    const [page] = await openPages(context, server.origin, ['news-a']);

    const input = await openPalette(sw, page!);
    await input.fill('official react docs');
    await expect(page!.getByRole('option', { name: /Instant Links: “official react docs”/ })).toBeVisible();
    await input.press('Enter');

    const results = page!.getByRole('listbox', { name: 'Search results' }).getByRole('option');
    await expect(results).toHaveCount(2);
    await expect(results.first()).toContainText('Hooks reference – React');
    await expect(results.first()).toContainText('Best match');
    await expect(results.first()).toContainText('Official React documentation');
    await expect(results.first()).toContainText(`${server.origin}/page/react-hooks`);
    expect(server.gets).toContain('/searx/search');

    const opened = context.waitForEvent('page');
    await page!.getByRole('textbox', { name: 'Instant Links search' }).press('Enter');
    await expect.poll(async () => (await opened).url()).toBe(`${server.origin}/page/react-hooks`);
  });

  test('refuses to open a URL that did not come from the search', async ({ context, sw, server }) => {
    await configureMockProvider(sw, server.origin);
    const settings = await context.newPage();
    await settings.goto(sw.url().replace('background.js', 'options.html'));
    const reply = await settings.evaluate(() => chrome.runtime.sendMessage({ type: 'instant/open', url: 'https://evil.example/' }));
    expect(reply).toMatchObject({ ok: false, error: { kind: 'invalid-output' } });
    expect(context.pages().some((p) => p.url().includes('evil.example'))).toBe(false);
  });

  test('without a search provider, offers the browser search instead of guessing', async ({ context, sw, server }) => {
    await configureMockProvider(sw, server.origin);
    const [page] = await openPages(context, server.origin, ['news-a']);
    const input = await openPalette(sw, page!);
    await input.fill('instant links');
    await input.press('Enter');
    const search = page!.getByRole('textbox', { name: 'Instant Links search' });
    await search.fill('helium browser');
    await search.press('Enter');
    await expect(page!.getByText('No search provider is set up.')).toBeVisible();
    await expect(page!.getByRole('button', { name: 'Search “helium browser” with your search engine' })).toBeFocused();
    expect(server.requests).toHaveLength(0);
  });
});

test.describe('Tidy Downloads', () => {
  /**
   * Playwright normally intercepts downloads, which skips onDeterminingFilename. This profile has its
   * own downloads folder and the browser's default download handling, like a real user's.
   */
  async function downloadWith(server: Awaited<ReturnType<typeof startFixtureServer>>, settings: Record<string, unknown>, model = 'mock') {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-profile-'));
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-downloads-'));
    fs.mkdirSync(path.join(profile, 'Default'));
    fs.writeFileSync(
      path.join(profile, 'Default', 'Preferences'),
      JSON.stringify({ download: { default_directory: folder, prompt_for_download: false } }),
    );
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    try {
      const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
      const page = await context.newPage();
      await page.goto(sw.url().replace('background.js', 'options.html'));
      await (await context.newCDPSession(page)).send('Browser.setDownloadBehavior', { behavior: 'default' });
      await configureMockProvider(sw, server.origin, model, settings);
      const started = Date.now();
      const state = await page.evaluate(async (url) => {
        const id = await chrome.downloads.download({ url });
        for (;;) {
          const [item] = await chrome.downloads.search({ id });
          if (item && item.state !== 'in_progress') return item.state;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }, `${server.origin}/files/inv_8812.pdf`);
      return { state, files: fs.readdirSync(folder), seconds: (Date.now() - started) / 1000 };
    } finally {
      await context.close();
    }
  }

  test('saves under an AI name with the original extension', async ({ server }) => {
    const result = await downloadWith(server, { tidyDownloads: true });
    expect(result).toMatchObject({ state: 'complete', files: ['Acme invoice 8812.pdf'] });
    const sent = server.requests[0]!.user;
    expect(sent).toContain('Original filename: inv_8812.pdf');
    expect(sent).toContain('Type: application/pdf');
  });

  test('keeps the original name when the AI is too slow', async ({ server }) => {
    const result = await downloadWith(server, { tidyDownloads: true }, 'mock-slow');
    expect(result).toMatchObject({ state: 'complete', files: ['inv_8812.pdf'] });
    expect(result.seconds).toBeLessThan(5.5);
  });

  test('does nothing when turned off', async ({ server }) => {
    const result = await downloadWith(server, { tidyDownloads: false });
    expect(result).toMatchObject({ state: 'complete', files: ['inv_8812.pdf'] });
    expect(server.requests).toHaveLength(0);
  });
});
