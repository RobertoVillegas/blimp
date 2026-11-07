import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { EXTENSION, expect, test } from './helpers';

test('update notice, then copying new files and pressing Reload picks them up and keeps settings', async () => {
  // A throwaway copy stands in for the folder the user loaded and later overwrites.
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-installed-'));
  fs.cpSync(EXTENSION, folder, { recursive: true });
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${folder}`, `--load-extension=${folder}`],
  });
  try {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    // Loading from a folder requires Developer mode, and with it off Chromium disables a folder
    // extension when it reloads. Turn it on the way the chrome://extensions toggle does.
    const extensionsPage = await context.newPage();
    await extensionsPage.goto('chrome://extensions');
    await extensionsPage.evaluate(() =>
      (globalThis as unknown as { chrome: { developerPrivate: { updateProfileConfiguration(c: object): Promise<void> } } }).chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }),
    );
    await extensionsPage.close();
    const current = await sw.evaluate(() => chrome.runtime.getManifest().version);
    const update = {
      version: '9.9.9',
      pageUrl: 'https://github.com/RobertoVillegas/helium-max/releases/tag/v9.9.9',
      downloadUrl: 'https://github.com/RobertoVillegas/helium-max/releases/download/v9.9.9/helium-max-9.9.9-chrome.zip',
    };
    await sw.evaluate(async (stored) => {
      await chrome.storage.local.set({ 'update:available': stored, 'update:checkedAt': Date.now() });
      await chrome.storage.local.set({ settings: { activeProfileId: 'keep', profiles: [{ id: 'keep', preset: 'custom', name: 'Keep me', model: 'm', baseUrl: 'http://127.0.0.1:1/v1' }] } });
    }, update);

    const palette = await context.newPage();
    await palette.goto(sw.url().replace('background.js', 'palette.html'));
    await expect(palette.getByRole('option', { name: /Helium Max 9.9.9 is available/ })).toBeVisible();

    const settings = await context.newPage();
    await settings.goto(sw.url().replace('background.js', 'options.html#updates'));
    await expect(settings.getByText(`You're on version ${current}.`)).toBeVisible();
    await expect(settings.getByRole('link', { name: 'Download helium-max-9.9.9-chrome.zip' })).toHaveAttribute('href', update.downloadUrl);

    // "Unzip over the folder": the new build has a new version.
    const manifestPath = path.join(folder, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, version: '9.9.9' }));

    const extensionUrl = sw.url().replace('background.js', '');
    await settings.locator('.update-banner').getByRole('button', { name: 'Reload Helium Max' }).click();

    // Playwright doesn't report the restarted worker (same URL), so read the new state from an extension page.
    const fresh = await context.newPage();
    await expect
      .poll(async () => {
        await fresh.goto(`${extensionUrl}palette.html`).catch(() => undefined);
        return fresh.evaluate(() => chrome.runtime.getManifest().version).catch(() => '');
      })
      .toBe('9.9.9');
    const after = await fresh.evaluate(async () => ({
      profile: ((await chrome.storage.local.get('settings')).settings as { profiles: { name: string }[] }).profiles[0]!.name,
      badge: await chrome.action.getBadgeText({}),
    }));
    expect(after).toEqual({ profile: 'Keep me', badge: '' });
    await expect(fresh.getByRole('option', { name: 'Tidy Tabs Command', exact: true })).toBeVisible();
    await expect(fresh.getByRole('option', { name: /is available/ })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('reloads itself, with no clicks, when the updater puts a newer build in its folder', async () => {
  test.setTimeout(120_000);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-installed-'));
  fs.cpSync(EXTENSION, folder, { recursive: true });
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${folder}`, `--load-extension=${folder}`],
  });
  try {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionsPage = await context.newPage();
    await extensionsPage.goto('chrome://extensions');
    await extensionsPage.evaluate(() =>
      (globalThis as unknown as { chrome: { developerPrivate: { updateProfileConfiguration(c: object): Promise<void> } } }).chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }),
    );
    await extensionsPage.close();
    const base = sw.url().replace('background.js', '');
    const before = await sw.evaluate(() => chrome.runtime.getManifest().version);

    // What the Mac updater does: replace the files, manifest last.
    const manifestPath = path.join(folder, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, version: '9.9.9' }));

    // No clicks: the once-a-minute check notices and reloads. Reloading closes extension pages,
    // so each look uses a fresh tab.
    const versionNow = async () => {
      const page = await context.newPage();
      try {
        await page.goto(`${base}options.html#updates`);
        return await page.evaluate(() => chrome.runtime.getManifest().version);
      } catch {
        return '';
      } finally {
        await page.close().catch(() => undefined);
      }
    };
    await expect.poll(versionNow, { timeout: 90_000, intervals: [5_000] }).toBe('9.9.9');
    const settings = await context.newPage();
    await settings.goto(`${base}options.html#updates`);
    await expect(settings.getByText(`Updated automatically from ${before} to 9.9.9`)).toBeVisible();
  } finally {
    await context.close();
  }
});
