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
