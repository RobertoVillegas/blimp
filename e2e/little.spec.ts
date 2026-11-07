import type { Worker } from '@playwright/test';
import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

const windows = (sw: Worker) =>
  sw.evaluate(async () =>
    (await chrome.windows.getAll({ populate: true })).map((w) => ({ id: w.id!, type: w.type, width: w.width, urls: w.tabs!.map((t) => t.pendingUrl || t.url) })),
  );

test('Little Blimp: open from the palette, go to an address, keep the page in the main window', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['news-a']);

  const input = await openPalette(sw, page!);
  await input.fill('little blimp');
  const opened = context.waitForEvent('page', { predicate: (p) => p.url().endsWith('/little.html') });
  await input.press('Enter');
  const little = await opened;
  await expect.poll(async () => (await windows(sw)).filter((w) => w.type === 'popup')).toHaveLength(1);

  const box = little.getByRole('textbox', { name: 'Search or enter an address' });
  await expect(box).toBeFocused();
  await box.fill(`${server.origin}/page/react-hooks`);
  await box.press('Enter');
  await expect(little).toHaveTitle('Hooks reference – React');

  // In a Little Blimp window, keeping the page is the first command.
  const palette = await openPalette(sw, little);
  await expect(little.getByRole('option').first()).toContainText('Open in Main Window');
  await palette.press('Enter');

  await expect.poll(async () => (await windows(sw)).filter((w) => w.type === 'popup')).toHaveLength(0);
  const [main] = (await windows(sw)).filter((w) => w.type === 'normal');
  expect(main!.urls).toContain(`${server.origin}/page/react-hooks`);
  // The same page moved, not a reload: it's still the tab Playwright knows.
  expect(little.isClosed()).toBe(false);
});

test('Little Blimp remembers its size and Close Little Blimp Windows closes them all', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['news-a']);
  // Messages from the worker don't reach its own listener, so send them from an extension page.
  const ext = await context.newPage();
  await ext.goto(sw.url().replace('background.js', 'palette.html'));
  await ext.evaluate(() => chrome.runtime.sendMessage({ type: 'little/open' }));
  await expect.poll(async () => (await windows(sw)).filter((w) => w.type === 'popup')).toHaveLength(1);
  const popup = (await windows(sw)).find((w) => w.type === 'popup')!;
  // Resize like a user would, after the window has settled.
  await new Promise((resolve) => setTimeout(resolve, 1_700));
  await sw.evaluate((id) => chrome.windows.update(id, { left: 0, top: 0, width: 700 }), popup.id);
  await expect.poll(() => sw.evaluate(async () => ((await chrome.storage.local.get('little:bounds'))['little:bounds'] as { width: number } | undefined)?.width)).toBe(700);

  await ext.evaluate(() => chrome.runtime.sendMessage({ type: 'little/open' }));
  await expect.poll(async () => (await windows(sw)).filter((w) => w.type === 'popup').length).toBe(2);
  const widths = (await windows(sw)).filter((w) => w.type === 'popup').map((w) => w.width);
  expect(widths).toEqual([700, 700]);

  // A saved position that is off screen now still opens a window.
  await sw.evaluate(() => chrome.storage.local.set({ 'little:bounds': { width: 700, height: 600, left: 99999, top: 99999 } }));
  await ext.evaluate(() => chrome.runtime.sendMessage({ type: 'little/open' }));
  await expect.poll(async () => (await windows(sw)).filter((w) => w.type === 'popup').length).toBe(3);

  const input = await openPalette(sw, page!);
  await input.fill('close little blimp');
  await input.press('Enter');
  await expect.poll(async () => (await windows(sw)).filter((w) => w.type === 'popup')).toHaveLength(0);
});
