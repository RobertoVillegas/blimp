import type { BrowserContext, Worker } from '@playwright/test';
import { configureMockProvider, expect, openPages, test } from './helpers';

// Headless Chromium has no window UI to show a side panel in, so the panel page opens in its own
// window, pointed at the window with the tabs. Whether the column appears is checked by hand in Helium.
async function openSidebar(context: BrowserContext, sw: Worker) {
  const windowId = await sw.evaluate(async () => (await chrome.windows.getLastFocused()).id!);
  const opened = context.waitForEvent('page');
  await sw.evaluate((url) => chrome.windows.create({ url }), sw.url().replace('background.js', `sidepanel.html?window=${windowId}`));
  const panel = await opened;
  await panel.setViewportSize({ width: 300, height: 760 });
  return panel;
}

test('the sidebar shows favorites, folders and Today, and peeks at Gmail and Calendar on hover', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock', { peeks: { gmail: true } });
  await sw.evaluate((base) => chrome.storage.local.set({ 'e2e:gmailBase': base }), server.origin);
  await sw.evaluate((url) => chrome.storage.session.set({ 'secret:calendar:ics': url }), `${server.origin}/calendar.ics`);
  // Stand-ins for Gmail and Calendar, so their favorites are recognized.
  await context.route(/^https:\/\/(mail|calendar)\.google\.com\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: `<title>${new URL(route.request().url()).hostname}</title>` }),
  );
  const [gmail, calendar, , , news] = await openPages(context, server.origin, ['react-hooks', 'react-state', 'weather-paris', 'recipe-pasta', 'news-a']);
  await gmail!.goto('https://mail.google.com/mail/u/0/#inbox');
  await calendar!.goto('https://calendar.google.com/calendar/r');
  await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const byUrl = (part: string) => tabs.find((tab) => tab.url!.includes(part))!.id!;
    await chrome.tabs.update(byUrl('mail.google.com'), { pinned: true });
    await chrome.tabs.update(byUrl('calendar.google.com'), { pinned: true });
    const group = await chrome.tabs.group({ tabIds: [byUrl('weather-paris'), byUrl('recipe-pasta')] });
    await chrome.tabGroups.update(group, { title: 'Weekend', color: 'green' });
  });
  await news!.bringToFront();

  const panel = await openSidebar(context, sw);
  await expect(panel.getByRole('list', { name: 'Favorites' }).getByRole('button')).toHaveCount(2);
  await expect(panel.getByRole('button', { name: 'Weekend' })).toBeVisible();
  await expect(panel.getByRole('list', { name: 'Weekend' }).getByRole('button', { name: /^Close / })).toHaveCount(2);
  await expect(panel.getByRole('list', { name: "Today's tabs" })).toContainText('Local news A');
  if (process.env.SCREENSHOTS) {
    await panel.screenshot({ path: 'docs/images/sidebar.png' });
    await panel.emulateMedia({ colorScheme: 'dark' });
    await panel.screenshot({ path: 'docs/images/sidebar-dark.png' });
    await panel.emulateMedia({ colorScheme: 'light' });
  }

  await panel.getByRole('button', { name: 'mail.google.com' }).hover();
  const mail = panel.getByRole('dialog', { name: 'Unread email' });
  await expect(mail).toContainText('2 unread');
  await expect(mail).toContainText('Lunch on Friday?');
  if (process.env.SCREENSHOTS) await panel.screenshot({ path: 'docs/images/sidebar-gmail.png' });

  await panel.getByRole('button', { name: 'calendar.google.com' }).hover();
  const events = panel.getByRole('dialog', { name: 'Upcoming events' });
  await expect(events).toContainText('Design review');
  await expect(events.getByRole('button', { name: 'Join' })).toBeVisible();
  if (process.env.SCREENSHOTS) await panel.screenshot({ path: 'docs/images/sidebar-calendar.png' });

  // Leaving the card closes it.
  await panel.getByRole('button', { name: 'Archive' }).hover();
  await expect(events).toBeHidden();

  // Collapsing a folder collapses the tab group too.
  await panel.getByRole('button', { name: 'Weekend' }).click();
  await expect.poll(() => sw.evaluate(async () => (await chrome.tabGroups.query({ title: 'Weekend' }))[0]!.collapsed)).toBe(true);
  await panel.getByRole('button', { name: 'Weekend' }).click();
});

test('drag tabs between Today, folders and favorites; Clear archives Today and Archive brings tabs back', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  await openPages(context, server.origin, ['news-a', 'news-b', 'weather-paris']);
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ title: 'Paris weather forecast' });
    const group = await chrome.tabs.group({ tabIds: [tab!.id!] });
    await chrome.tabGroups.update(group, { title: 'Trips' });
  });
  const panel = await openSidebar(context, sw);
  const today = panel.getByRole('list', { name: "Today's tabs" });
  const trips = panel.getByRole('list', { name: 'Trips' });

  // Into a folder: the tab joins the group.
  await today.getByText('Local news B').dragTo(trips.getByText('Paris weather'));
  await expect(trips).toContainText('Local news B');
  const grouped = await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ title: 'Local news B' });
    const [group] = await chrome.tabGroups.query({ title: 'Trips' });
    return tab!.groupId === group!.id;
  });
  expect(grouped).toBe(true);

  // Onto favorites: the tab is pinned.
  await today.getByText('Local news A').dragTo(panel.getByText('Drag a tab here, or pin it, to make it a favorite.'));
  await expect(panel.getByRole('list', { name: 'Favorites' }).getByRole('button')).toHaveCount(1);
  expect(await sw.evaluate(async () => (await chrome.tabs.query({ title: 'Local news A' }))[0]!.pinned)).toBe(true);

  // Back to Today: unpinned.
  await panel.getByRole('list', { name: 'Favorites' }).getByRole('button').dragTo(panel.getByText('Today', { exact: true }));
  await expect(today).toContainText('Local news A');
  expect(await sw.evaluate(async () => (await chrome.tabs.query({ title: 'Local news A' }))[0]!.pinned)).toBe(false);

  // Clear archives Today (folders stay), and Archive reopens a tab.
  await panel.getByRole('button', { name: 'Clear' }).click();
  await expect(panel.getByRole('status')).toContainText('Archived');
  await expect(today.getByRole('button', { name: /^Close / })).toHaveCount(0);
  await expect(trips).toContainText('Paris weather');
  await panel.getByRole('button', { name: 'Archive' }).click();
  const archived = panel.getByRole('list', { name: 'Archived tabs' });
  await expect(archived).toContainText('Local news A');
  await archived.getByRole('button', { name: /Local news A/ }).click();
  await expect(today).toContainText('Local news A');
});
