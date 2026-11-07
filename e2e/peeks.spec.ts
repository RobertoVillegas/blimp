import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

test('Unread Email peeks at Gmail and opens a message', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock', { peeks: { gmail: true } });
  await sw.evaluate((base) => chrome.storage.local.set({ 'e2e:gmailBase': base }), server.origin);
  const [page] = await openPages(context, server.origin, ['news-a']);

  const input = await openPalette(sw, page!);
  await input.fill('unread email');
  await input.press('Enter');
  const list = page!.getByRole('list', { name: 'Unread email' });
  await expect(page!.getByText('2 unread')).toBeVisible();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('listitem').first()).toContainText('Ana');
  await expect(list.getByRole('listitem').first()).toContainText('Lunch on Friday?');
  expect(server.requests).toHaveLength(0);

  const opened = context.waitForEvent('page');
  await list.getByRole('listitem').first().click();
  const message = await opened;
  await message.waitForLoadState();
  await expect(message).toHaveTitle('Mail message');
  expect(message.url()).toBe(`${server.origin}/mail/u/0?message_id=lunch`);
});

test('Upcoming Events reads the iCal address and offers to join the meeting', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  await sw.evaluate((url) => chrome.storage.session.set({ 'secret:calendar:ics': url }), `${server.origin}/calendar.ics`);
  const [page] = await openPages(context, server.origin, ['news-a']);

  const input = await openPalette(sw, page!);
  await input.fill('upcoming events');
  await input.press('Enter');
  const list = page!.getByRole('list', { name: 'Upcoming events' });
  await expect(list).toContainText('Design review');
  await expect(list).toContainText('Room 4');
  await expect(list.getByRole('button', { name: 'Join' })).toBeVisible();
});

test('peeks explain how to set them up', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['news-a']);
  const input = await openPalette(sw, page!);
  await input.fill('unread email');
  await input.press('Enter');
  await expect(page!.getByText('Turn on Gmail in Settings › Peeks first.')).toBeVisible();
  await expect(page!.getByRole('button', { name: 'Open Settings' })).toBeVisible();
});
