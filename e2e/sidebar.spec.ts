import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

// Chromium opens a side panel only straight from a user action, and headless Chromium has no
// window UI to show one in, so this checks the shortcut wiring, the palette's guidance, and the
// panel page itself. Whether the column appears is checked by hand in Helium.
test('the sidebar: shortcut and toolbar menu are registered, the palette explains them, the panel lists pinned tabs', async ({
  context,
  sw,
  server,
}) => {
  await configureMockProvider(sw, server.origin);
  const [hooks, paris] = await openPages(context, server.origin, ['react-hooks', 'weather-paris']);
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ title: 'Hooks reference – React' });
    await chrome.tabs.update(tab!.id!, { pinned: true });
  });

  const shortcut = await sw.evaluate(async () => (await chrome.commands.getAll()).find((c) => c.name === 'open-sidebar')?.shortcut);
  // ⇧⌘S on macOS, Ctrl+Shift+S elsewhere.
  expect(shortcut).toMatch(/^(⇧⌘S|Ctrl\+Shift\+S)$/);

  const input = await openPalette(sw, paris!);
  await input.fill('open sidebar');
  await input.press('Enter');
  await expect(paris!.getByText(`Press ${shortcut}, or right-click the Helium Max icon`)).toBeVisible();

  const panel = await context.newPage();
  await panel.goto(sw.url().replace('background.js', 'sidepanel.html'));
  await expect(panel.getByRole('list', { name: 'Pinned tabs' }).getByRole('button')).toHaveText(['Hooks reference – React']);
  await panel.getByRole('button', { name: 'Hooks reference – React' }).click();
  await expect.poll(() => hooks!.evaluate(() => document.visibilityState)).toBe('visible');
});
