import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

test('Open Sidebar opens the side panel, which lists pinned tabs and switches to one on click', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [hooks, paris] = await openPages(context, server.origin, ['react-hooks', 'weather-paris']);
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ title: 'Hooks reference – React' });
    await chrome.tabs.update(tab!.id!, { pinned: true });
  });

  const input = await openPalette(sw, paris!);
  await input.fill('open sidebar');
  await input.press('Enter');
  // sidePanel.open succeeded (an error would keep the palette open). Headless Chromium has no
  // window UI to show the panel in, so its page is checked directly.
  await expect(input).toBeHidden();
  await expect(paris!.getByRole('alert')).toHaveCount(0);
  const panel = await context.newPage();
  await panel.goto(sw.url().replace('background.js', 'sidepanel.html'));

  await expect(panel.getByRole('list', { name: 'Pinned tabs' }).getByRole('button')).toHaveText(['Hooks reference – React']);
  await panel.getByRole('button', { name: 'Hooks reference – React' }).click();
  await expect.poll(() => hooks!.evaluate(() => document.visibilityState)).toBe('visible');
});
