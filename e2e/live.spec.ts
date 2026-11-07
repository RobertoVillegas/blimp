import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

test('Live Folders: a feed marks only items that arrive later as new, and opens them', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock', {
    liveFolders: [{ id: 'blog', name: 'Fixture Blog', kind: 'feed', query: '', url: `${server.origin}/feed.xml` }],
  });
  const [page] = await openPages(context, server.origin, ['recipe-pasta']);

  let input = await openPalette(sw, page!);
  await input.fill('live folders');
  await input.press('Enter');
  const folders = page!.getByRole('listbox', { name: 'Live Folders' });
  await expect(folders.getByRole('option')).toHaveText([/Fixture Blog.*2 items/]);
  await page!.keyboard.press('Escape');
  await page!.keyboard.press('Escape');

  // A new post is published; a refresh marks only it as new.
  await fetch(`${server.origin}/feed/publish`);
  input = await openPalette(sw, page!);
  await input.fill('live folders');
  await input.press('Enter');
  await page!.getByRole('button', { name: 'Refresh' }).click();
  await expect(folders.getByRole('option')).toHaveText([/Fixture Blog.*1 new/]);
  await page!.keyboard.press('Enter');
  const items = page!.getByRole('listbox', { name: 'Fixture Blog items' }).getByRole('option');
  await expect(items).toHaveText(['Post 3', 'Post 2', 'Post 1']);
  await expect(items.nth(0).getByLabel('New')).toBeVisible();
  await expect(items.nth(1).getByLabel('New')).toHaveCount(0);

  const opened = context.waitForEvent('page');
  await page!.keyboard.press('Enter');
  const post = await opened;
  await post.waitForLoadState();
  expect(post.url()).toBe(`${server.origin}/page/news-a?post=3`);
  const unread = await sw.evaluate(async () => {
    const state = (await chrome.storage.local.get('live:state'))['live:state'] as Record<string, { seen: string[] }>;
    return state.blog!.seen.includes('post-3');
  });
  expect(unread).toBe(true);
});

test('Live Folders: GitHub pull requests with a token; a missing token is explained', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock', {
    liveFolders: [{ id: 'prs', name: 'Review requests', kind: 'github', query: 'review', url: '' }],
  });
  await sw.evaluate((api) => chrome.storage.local.set({ 'e2e:githubApi': api }), `${server.origin}/gh`);
  const [page] = await openPages(context, server.origin, ['recipe-pasta']);

  let input = await openPalette(sw, page!);
  await input.fill('live folders');
  await input.press('Enter');
  await page!.getByRole('option', { name: /Review requests/ }).click();
  await expect(page!.getByRole('alert')).toContainText('Add a GitHub token');
  await page!.keyboard.press('Escape');
  await page!.keyboard.press('Escape');

  await sw.evaluate(() => chrome.storage.session.set({ 'secret:github:token': 'test-token' }));
  input = await openPalette(sw, page!);
  await input.fill('live folders');
  await input.press('Enter');
  await page!.getByRole('button', { name: 'Refresh' }).click();
  await page!.getByRole('option', { name: /Review requests/ }).click();
  await expect(page!.getByRole('listbox', { name: 'Review requests items' }).getByRole('option')).toHaveText([/Add dark mode.*acme\/web#7 · ana/]);
  expect(server.gets).toContain('/gh/search/issues');
});
