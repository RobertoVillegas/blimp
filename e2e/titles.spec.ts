import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

const tabTitle = (sw: import('@playwright/test').Worker, path: string) =>
  sw.evaluate(async (suffix) => (await chrome.tabs.query({})).find((tab) => tab.url?.endsWith(suffix))?.title, path);

test('Tidy Tab Titles proposes names for pinned tabs, keeps them through title changes and reloads, and restores', async ({
  context,
  sw,
  server,
}) => {
  await configureMockProvider(sw, server.origin);
  const [inbox, hooks, other] = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
  await inbox!.goto(`${server.origin}/inbox`);
  await hooks!.goto(`${server.origin}/page/react-hooks`);
  await other!.goto(`${server.origin}/page/news-a`);
  await sw.evaluate(async () => {
    for (const tab of await chrome.tabs.query({})) {
      if (tab.url?.endsWith('/inbox') || tab.url?.endsWith('/react-hooks')) await chrome.tabs.update(tab.id!, { pinned: true });
    }
  });

  const input = await openPalette(sw, other!);
  await input.fill('tidy tab titles');
  await input.press('Enter');

  const names = other!.getByRole('list', { name: 'Proposed names' });
  await expect(names.getByRole('textbox')).toHaveCount(2);
  await expect(other!.getByRole('textbox', { name: /New name for Inbox \(3\)/ })).toHaveValue('Mail');
  // Quotes from the model are stripped.
  await expect(other!.getByRole('textbox', { name: /New name for Hooks reference/ })).toHaveValue('React Hooks');
  expect(await tabTitle(sw, '/inbox')).toBe('Inbox (3) - someone@example.com - Example Mail');

  await other!.getByRole('textbox', { name: /New name for Hooks reference/ }).fill('Hooks');
  await other!.getByRole('button', { name: 'Rename 2 tabs' }).click();
  await expect(other!.getByText('They stay after reloads and restarts.')).toBeVisible();

  // The unread count survives; the site's own title changes don't undo the name.
  await expect.poll(() => tabTitle(sw, '/inbox')).toBe('(3) Mail');
  await expect.poll(() => tabTitle(sw, '/react-hooks')).toBe('Hooks');
  await inbox!.evaluate(() => (window as unknown as { setUnread(n: number): void }).setUnread(7));
  await expect.poll(() => tabTitle(sw, '/inbox')).toBe('(7) Mail');
  await hooks!.reload();
  await expect.poll(() => tabTitle(sw, '/react-hooks')).toBe('Hooks');
  expect(await tabTitle(sw, '/news-a')).toBe('Local news A');

  await other!.keyboard.press('Escape');
  await other!.keyboard.press('Escape');
  const again = await openPalette(sw, other!);
  await again.fill('restore tab titles');
  await again.press('Enter');
  await expect(other!.getByText('2 tabs got their site\'s title back.')).toBeVisible();
  await expect.poll(() => tabTitle(sw, '/inbox')).toBe('Inbox (7) - someone@example.com - Example Mail');
  await expect.poll(() => tabTitle(sw, '/react-hooks')).toBe('Hooks reference – React');
});

test('Rename Tab names one tab and asks for site access when it would not survive a reload', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['recipe-pasta']);
  const input = await openPalette(sw, page!);
  await input.fill('rename tab');
  await input.press('Enter');
  const name = page!.getByRole('textbox', { name: 'New name for this tab' });
  await expect(name).toHaveValue('Easy pasta recipe');
  await name.fill('Pasta');
  await name.press('Enter');
  await expect.poll(() => tabTitle(sw, '/recipe-pasta')).toBe('Pasta');
  expect(server.requests).toHaveLength(0);

  // A site Helium Max has no access to (localhost ≠ 127.0.0.1): it asks before it can keep the name.
  const other = await context.newPage();
  await other.goto(server.origin.replace('127.0.0.1', 'localhost') + '/page/news-b');
  const otherId = await sw.evaluate(async () => (await chrome.tabs.query({ title: 'Local news B' }))[0]!.id!);
  const popup = await context.newPage();
  await popup.goto(sw.url().replace('background.js', `palette.html?tabId=${otherId}`));
  await popup.getByRole('combobox').fill('rename tab');
  await popup.getByRole('combobox').press('Enter');
  const field = popup.getByRole('textbox', { name: 'New name for this tab' });
  await expect(field).toHaveValue('Local news B');
  await field.fill('News');
  await field.press('Enter');
  await expect(popup.getByText('needs access to:')).toBeVisible();
  await expect(popup.getByText(/^localhost$/)).toBeVisible();
});
