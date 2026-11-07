import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

test('auto-archive closes stale tabs, keeps protected ones, and Archived Tabs reopens them', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock', { autoArchive: '24h' });
  const pages = await openPages(context, server.origin, ['news-a', 'news-b', 'recipe-pasta', 'react-hooks']);
  await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    await chrome.tabs.update(tabs.find((t) => t.title === 'Local news A')!.id!, { pinned: true });
    await chrome.tabs.group({ tabIds: [tabs.find((t) => t.title === 'Easy pasta recipe')!.id!] });
  });
  await pages[3]!.bringToFront();

  // Pretend 25 hours passed (only e2e builds accept a clock).
  const ext = await context.newPage();
  await ext.goto(sw.url().replace('background.js', 'palette.html'));
  await pages[3]!.bringToFront();
  const archived = await ext.evaluate(() => chrome.runtime.sendMessage({ type: 'archive/run', now: Date.now() + 25 * 3_600_000 }));
  expect(archived).toMatchObject({ ok: true, data: 1 });
  const titles = await sw.evaluate(async () => (await chrome.tabs.query({ windowType: 'normal' })).map((t) => t.title));
  // Pinned, grouped and the active tab stay; the extension page isn't a web page; news B goes.
  expect(titles).toEqual(expect.arrayContaining(['Local news A', 'Easy pasta recipe', 'Hooks reference – React']));
  expect(titles).not.toContain('Local news B');

  const input = await openPalette(sw, pages[3]!);
  await input.fill('archived tabs');
  await input.press('Enter');
  const list = pages[3]!.getByRole('listbox', { name: 'Archived tabs' });
  await expect(list.getByRole('option')).toHaveText([/Local news B/]);
  await pages[3]!.getByRole('textbox', { name: 'Search archived tabs' }).press('Enter');
  await expect
    .poll(() => sw.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.title)))
    .toContain('Local news B');
  const left = await sw.evaluate(async () => ((await chrome.storage.local.get('archive:entries'))['archive:entries'] as unknown[]).length);
  expect(left).toBe(0);
});

test('auto-archive does nothing while it is off', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  await openPages(context, server.origin, ['news-a', 'news-b']);
  const ext = await context.newPage();
  await ext.goto(sw.url().replace('background.js', 'palette.html'));
  expect(await ext.evaluate(() => chrome.runtime.sendMessage({ type: 'archive/run', now: Date.now() + 99 * 86_400_000 }))).toMatchObject({ data: 0 });
});
