import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

test('empty palette: most recently used tabs first, then commands by how much they are used', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const pages = await openPages(context, server.origin, ['news-a', 'news-b', 'recipe-pasta', 'react-hooks']);
  // Use them out of order: pasta, then news A, then come back to hooks.
  await pages[2]!.bringToFront();
  await pages[0]!.bringToFront();
  await pages[3]!.bringToFront();

  let input = await openPalette(sw, pages[3]!);
  const options = pages[3]!.getByRole('option');
  await expect(options.nth(0)).toContainText('Local news A');
  await expect(options.nth(1)).toContainText('Easy pasta recipe');

  // Use Copy URL twice: it rises above the default first command.
  for (let i = 0; i < 2; i++) {
    await input.fill('copy url');
    await input.press('Enter');
    await expect(pages[3]!.locator('helium-max-palette')).toHaveCount(0);
    input = await openPalette(sw, pages[3]!);
  }
  const firstCommand = pages[3]!.getByRole('option', { name: /Command$/ }).first();
  await expect(firstCommand).toContainText('Copy URL');
});

test('typing: what you picked for a query before comes first next time, also for its beginning', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const pages = await openPages(context, server.origin, ['news-a', 'react-state', 'react-hooks']);
  let input = await openPalette(sw, pages[0]!);
  await input.fill('react');
  // By default the matching command comes before tabs; pick the Hooks tab instead.
  await pages[0]!.getByRole('option', { name: /Hooks reference/ }).click();
  await expect.poll(() => pages[2]!.evaluate(() => document.visibilityState)).toBe('visible');

  input = await openPalette(sw, pages[2]!);
  await input.fill('reac');
  await expect(pages[2]!.getByRole('option').first()).toContainText('Hooks reference');
  await input.press('Escape');

  // Settings can make it forget.
  const settings = await context.newPage();
  await settings.goto(sw.url().replace('background.js', 'options.html'));
  await settings.getByRole('button', { name: 'Forget what the palette learned' }).click();
  await expect(settings.getByText('The palette forgot')).toBeVisible();
  expect(await sw.evaluate(async () => (await chrome.storage.local.get('rank:data'))['rank:data'])).toBeUndefined();
});

test('Recent Pages lists the pages visited on this site and switches to one', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const visit = await context.newPage();
  for (const slug of ['weather-paris', 'recipe-tacos', 'news-b']) await visit.goto(`${server.origin}/page/${slug}`);
  const [page] = await openPages(context, server.origin, ['news-a']);

  const input = await openPalette(sw, page!);
  await input.fill('recent pages');
  await input.press('Enter');
  const list = page!.getByRole('listbox', { name: /Recent pages on 127.0.0.1/ });
  // Newest first, without the page you're on.
  await expect(list.getByRole('option')).toHaveText([/Local news B/, /Street tacos/, /Paris weather/]);
  const opened = context.waitForEvent('page');
  await page!.keyboard.press('ArrowDown');
  await page!.keyboard.press('Enter');
  const tacos = await opened;
  await tacos.waitForLoadState();
  expect(tacos.url()).toBe(`${server.origin}/page/recipe-tacos`);
});
