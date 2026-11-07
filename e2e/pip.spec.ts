import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

test('Picture in Picture floats the playing video from the palette and closes it the second time', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const page = await context.newPage();
  await page.goto(`${server.origin}/video`);
  await page.waitForFunction(() => !document.querySelector('video')!.paused);

  const input = await openPalette(sw, page);
  await input.fill('picture in picture');
  await input.press('Enter');
  await expect.poll(() => page.evaluate(() => document.pictureInPictureElement?.tagName)).toBe('VIDEO');
  await expect(input).toBeHidden();

  const again = await openPalette(sw, page);
  await again.fill('pip');
  await again.press('Enter');
  await expect.poll(() => page.evaluate(() => document.pictureInPictureElement)).toBeNull();
});

test('Picture in Picture explains when the page has no video', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['news-a']);
  const input = await openPalette(sw, page!);
  await input.fill('picture in picture');
  await input.press('Enter');
  await expect(page!.getByRole('alert')).toContainText('No video on this page');
});

test('auto-float: turning it on makes video pages offer picture in picture to the browser when the tab is left', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock', { autoFloat: true });
  await expect
    .poll(() => sw.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id)))
    .toContain('auto-float');
  const page = await context.newPage();
  await page.goto(`${server.origin}/video`);
  // The e2e build marks the page once the handler is registered with the browser.
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.heliumMaxAutoFloat)).toBe('ready');

  const article = await context.newPage();
  await article.goto(`${server.origin}/page/news-a`);
  expect(await article.evaluate(() => document.documentElement.dataset.heliumMaxAutoFloat)).toBeUndefined();

  await configureMockProvider(sw, server.origin, 'mock', { autoFloat: false });
  await expect
    .poll(() => sw.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id)))
    .not.toContain('auto-float');
});
