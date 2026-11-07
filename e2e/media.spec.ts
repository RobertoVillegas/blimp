import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

const isPaused = (page: import('@playwright/test').Page) => page.evaluate(() => document.querySelector('video')!.paused);

test('Now playing: the palette controls the video on this page, mutes the tab and opens picture in picture', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const page = await context.newPage();
  await page.goto(`${server.origin}/video`);
  await page.waitForFunction(() => !document.querySelector('video')!.paused);

  await openPalette(sw, page);
  const card = page.getByRole('region', { name: 'Now playing' });
  await expect(card).toContainText('Video page');
  await card.getByRole('button', { name: 'Pause' }).click();
  await expect.poll(() => isPaused(page)).toBe(true);
  await card.getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => isPaused(page)).toBe(false);

  await card.getByRole('button', { name: 'Mute tab' }).click();
  await expect
    .poll(() => sw.evaluate(async (url) => (await chrome.tabs.query({ url }))[0]!.mutedInfo?.muted, page.url()))
    .toBe(true);
  await expect(card.getByRole('button', { name: 'Unmute tab' })).toBeVisible();

  await card.getByRole('button', { name: 'Picture in picture' }).click();
  await expect.poll(() => page.evaluate(() => document.pictureInPictureElement?.tagName)).toBe('VIDEO');
  await page.evaluate(() => document.exitPictureInPicture());
});

test('Now playing: music in another tab shows its title, and Play or Pause Media controls it from anywhere', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  // openPages closes the tabs open before it, so the music tab comes after.
  const [other] = await openPages(context, server.origin, ['news-a']);
  const song = await context.newPage();
  await song.goto(`${server.origin}/song`);
  await song.click('h1');
  await expect.poll(() => sw.evaluate(async () => (await chrome.tabs.query({ audible: true })).length), { timeout: 10_000 }).toBe(1);

  await openPalette(sw, other!);
  const card = other!.getByRole('region', { name: 'Now playing' });
  await expect(card).toContainText('Test Song');
  await expect(card).toContainText('The Fixtures');
  await expect(card.getByRole('button', { name: 'Go to tab' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Picture in picture' })).toHaveCount(0);

  const input = other!.getByRole('combobox', { name: 'Search commands and tabs' });
  await input.fill('play or pause');
  await input.press('Enter');
  await expect.poll(() => song.evaluate(() => document.querySelector('audio')!.paused)).toBe(true);
});

test('Now playing: a site without access offers to allow control, and still mutes', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  // openPages closes the tabs open before it, so the music tab comes after.
  const [other] = await openPages(context, server.origin, ['news-a']);
  const song = await context.newPage();
  await song.goto(server.origin.replace('127.0.0.1', 'localhost') + '/song');
  await song.click('h1');
  await expect.poll(() => sw.evaluate(async () => (await chrome.tabs.query({ audible: true })).length), { timeout: 10_000 }).toBe(1);

  await openPalette(sw, other!);
  const card = other!.getByRole('region', { name: 'Now playing' });
  await expect(card).toContainText('Music player');
  await expect(card.getByRole('button', { name: 'Allow control' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Pause' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Mute tab' }).click();
  await expect
    .poll(() => sw.evaluate(async () => (await chrome.tabs.query({ title: 'Music player' }))[0]!.mutedInfo?.muted))
    .toBe(true);
});
