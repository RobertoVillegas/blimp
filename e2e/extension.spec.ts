import type { Worker } from '@playwright/test';
import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

async function windowState(sw: Worker) {
  return sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groups = await chrome.tabGroups.query({});
    return {
      order: tabs.map((tab) => tab.title),
      pinned: tabs.filter((tab) => tab.pinned).map((tab) => tab.title),
      groups: groups
        .map((group) => ({
          title: group.title,
          color: group.color,
          tabs: tabs.filter((tab) => tab.groupId === group.id).map((tab) => tab.title).sort(),
        }))
        .sort((a, b) => a.title!.localeCompare(b.title!)),
    };
  });
}

test('palette opens, filters commands and tabs without AI, closes on Esc', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [first, second] = await openPages(context, server.origin, ['react-hooks', 'weather-paris']);

  const input = await openPalette(sw, first!);
  await expect(first!.getByRole('option', { name: 'Tidy Tabs Command', exact: true })).toBeVisible();
  await expect(first!.getByText('Local mock · mock')).toBeVisible();

  await input.fill('paris');
  // The matching tab, then the offer to search the web for the typed text.
  await expect(first!.getByRole('option')).toHaveText([/Paris weather forecast/, /Instant Links: “paris”/]);
  await input.press('Enter');
  await expect.poll(() => second!.evaluate(() => document.visibilityState)).toBe('visible');

  const again = await openPalette(sw, first!);
  await again.press('Escape');
  await expect(again).toBeHidden();
  expect(server.requests).toHaveLength(0);
});

test('the palette stays above page popovers and max-z-index elements', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const page = await context.newPage();
  await page.goto(`${server.origin}/greedy`);
  await openPalette(sw, page);
  await page.evaluate(() => (window as unknown as { addLateCover(): void }).addLateCover());

  // What a click in the middle of the palette would hit.
  const hit = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight * 0.25);
    return el?.closest('helium-max-palette') ? 'palette' : (el?.id ?? el?.tagName);
  });
  expect(hit).toBe('palette');
  await page.getByRole('option', { name: 'AI Settings Command', exact: true }).click({ trial: true });
});

test('Tidy Tabs groups only on request, keeps pinned tabs and existing groups, and undoes', async ({
  context,
  sw,
  server,
}) => {
  await configureMockProvider(sw, server.origin);
  const pages = await openPages(context, server.origin, [
    'news-a',
    'react-hooks',
    'weather-madrid',
    'recipe-pasta',
    'react-state',
    'weather-paris',
    'recipe-tacos',
    'news-b',
  ]);
  // A pinned tab and a user-made group that Tidy Tabs must leave alone.
  await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    await chrome.tabs.update(tabs.find((t) => t.title === 'Local news A')!.id!, { pinned: true });
    const groupId = await chrome.tabs.group({ tabIds: [tabs.find((t) => t.title === 'Local news B')!.id!] });
    await chrome.tabGroups.update(groupId, { title: 'Mine', color: 'pink' });
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  expect(server.requests).toHaveLength(0);
  const before = await windowState(sw);

  const input = await openPalette(sw, pages[1]!);
  await input.fill('tidy');
  await input.press('Enter');
  await expect(pages[1]!.getByText('Tabs tidied')).toBeVisible();

  expect(server.requests).toHaveLength(1);
  expect(server.requests[0]!.user).not.toContain('Local news A');
  expect(server.requests[0]!.user).not.toContain('Local news B');

  const after = await windowState(sw);
  expect(after.groups).toEqual([
    { title: 'Mine', color: 'pink', tabs: ['Local news B'] },
    { title: 'React docs', color: 'blue', tabs: ['Hooks reference – React', 'Managing state – React'] },
    { title: 'Recipes', color: 'orange', tabs: ['Easy pasta recipe', 'Street tacos recipe'] },
    { title: 'Weather', color: 'cyan', tabs: ['Madrid weather forecast', 'Paris weather forecast'] },
  ]);
  expect(after.pinned).toEqual(['Local news A']);
  expect([...after.order].sort()).toEqual([...before.order].sort());

  await pages[1]!.getByRole('button', { name: 'Undo Tidy Tabs' }).click();
  await expect(pages[1]!.getByText('Tidy Tabs undone')).toBeVisible();
  expect(await windowState(sw)).toEqual(before);
});

test('switching AI profile from the palette changes the model used', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['recipe-tacos']);

  const input = await openPalette(sw, page!);
  await input.fill('profile second');
  await expect(page!.getByRole('option', { name: /Use Second mock/ })).toBeVisible();
  await input.press('Enter');
  await expect(page!.getByText('Second mock · mock-b')).toBeVisible();

  await input.fill('summarize page');
  await input.press('Enter');
  await expect(page!.getByText(/MOCK SUMMARY/)).toBeVisible();
  expect(server.requests.at(-1)!.body.model).toBe('mock-b');
  const stored = await sw.evaluate(() => chrome.storage.local.get('settings'));
  expect((stored.settings as { activeProfileId: string }).activeProfileId).toBe('local-b');
});

test('a feature can use its own profile while others use the active one', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock', { featureProfiles: { page: 'local-b' } });
  const [page] = await openPages(context, server.origin, ['recipe-pasta', 'react-hooks', 'react-state']);

  const input = await openPalette(sw, page!);
  await input.fill('summarize page');
  await expect(page!.locator('.hm-footer')).toContainText('Second mock · mock-b');
  await input.press('Enter');
  await expect(page!.getByText(/MOCK SUMMARY/)).toBeVisible();
  expect(server.requests.at(-1)!.body.model).toBe('mock-b');

  await page!.keyboard.press('Escape');
  await page!.keyboard.press('Escape');
  const again = await openPalette(sw, page!);
  await again.fill('tidy');
  await expect(page!.locator('.hm-footer')).toContainText('Local mock · mock');
  await again.press('Enter');
  await expect(page!.getByText('Tabs tidied')).toBeVisible();
  expect(server.requests.at(-1)!.body.model).toBe('mock');
});

test('Tidy Tabs can add tabs to a group the user already has, and Undo takes them back out', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock', { tidyIntoExistingGroups: true });
  const pages = await openPages(context, server.origin, ['react-hooks', 'weather-madrid', 'react-state', 'weather-paris']);
  await sw.evaluate(async () => {
    const [hooks] = await chrome.tabs.query({ title: 'Hooks reference – React' });
    const groupId = await chrome.tabs.group({ tabIds: [hooks!.id!] });
    await chrome.tabGroups.update(groupId, { title: 'React docs', color: 'purple' });
  });
  const before = await windowState(sw);

  const input = await openPalette(sw, pages[1]!);
  await input.fill('tidy');
  await input.press('Enter');
  await expect(pages[1]!.getByText('1 tab added to your group')).toBeVisible();
  expect(server.requests[0]!.user).toContain('[G1] "React docs" contains: Hooks reference – React');

  expect((await windowState(sw)).groups).toEqual([
    { title: 'React docs', color: 'purple', tabs: ['Hooks reference – React', 'Managing state – React'] },
    { title: 'Weather', color: 'blue', tabs: ['Madrid weather forecast', 'Paris weather forecast'] },
  ]);

  await pages[1]!.getByRole('button', { name: 'Undo Tidy Tabs' }).click();
  await expect(pages[1]!.getByText('Tidy Tabs undone')).toBeVisible();
  expect(await windowState(sw)).toEqual(before);
});

test('invalid model output changes nothing', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock-bad');
  const pages = await openPages(context, server.origin, ['react-hooks', 'react-state', 'weather-paris']);
  const before = await windowState(sw);

  const input = await openPalette(sw, pages[0]!);
  await input.fill('tidy');
  await input.press('Enter');
  await expect(pages[0]!.getByRole('alert')).toContainText('Nothing was changed');
  expect(await windowState(sw)).toEqual(before);
});

test('Summarize and Ask Page use visible article text only', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['recipe-pasta']);

  const input = await openPalette(sw, page!);
  await input.fill('summarize page');
  await input.press('Enter');
  await expect(page!.getByText('MOCK SUMMARY of "Easy pasta recipe".')).toBeVisible();
  await expect(page!.getByText('point one')).toBeVisible();

  const sent = server.requests[0]!.user;
  expect(sent).toContain('Boil pasta for nine minutes');
  expect(sent).toContain('## Details');
  for (const leaked of ['hunter2-PASSWORD', 'FORM-VALUE', 'HIDDEN-SECRET-TEXT', 'NAVIGATION-CHROME', 'FOOTER-CHROME']) {
    expect(sent).not.toContain(leaked);
  }

  const followUp = page!.getByRole('textbox', { name: 'Question about this page' });
  await followUp.fill('How long do I boil it?');
  await followUp.press('Enter');
  await expect(page!.getByText(/MOCK ANSWER about "Easy pasta recipe" to: How long/)).toBeVisible();
  // The follow-up carries the conversation, with the page only in the first turn.
  const messages = server.requests[1]!.body.messages as { role: string; content: string }[];
  expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  expect(messages[1]!.content).toContain('Boil pasta');

  await page!.getByRole('button', { name: 'Forget this page conversation' }).click();
  const stored = await sw.evaluate(() => chrome.storage.session.get(null));
  expect(Object.keys(stored).filter((key) => key.startsWith('page:'))).toEqual([]);
});

test('popup palette explains that browser pages cannot be read', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const extensionId = new URL(sw.url()).host;
  const page = await context.newPage();
  await page.goto('chrome://version');
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'chrome://version/' }))[0]!.id!);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/palette.html?tabId=${tabId}`);
  const input = popup.getByRole('combobox', { name: 'Search commands and tabs' });
  await input.fill('summarize page');
  await input.press('Enter');
  await expect(popup.getByRole('alert')).toContainText('can only read regular web pages');
  expect(server.requests).toHaveLength(0);
});

test('content scripts cannot read session secrets', async ({ context, sw, server }) => {
  const [page] = await openPages(context, server.origin, ['news-a']);
  const outcome = await sw.evaluate(async (url) => {
    await chrome.storage.session.set({ 'secret:openai': 'sk-session-key' });
    const [tab] = await chrome.tabs.query({ url });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab!.id! },
      func: async () => {
        try {
          return JSON.stringify(await chrome.storage.session.get(null));
        } catch (error) {
          return `blocked: ${(error as Error).message}`;
        }
      },
    });
    return result!.result as string;
  }, page!.url());
  expect(outcome).toMatch(/^blocked:/);
});
