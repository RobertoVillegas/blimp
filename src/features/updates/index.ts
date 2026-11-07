import { loadSettings } from '@/storage/settings';
import { compareVersions, fetchUpdate, type AvailableUpdate } from './check';

export const UPDATE_KEY = 'update:available';
const CHECKED_KEY = 'update:checkedAt';
const ALARM = 'update-check';
const DISK_ALARM = 'disk-check';
const INTERVAL_HOURS = 12;
export const AUTO_UPDATED_KEY = 'update:auto';

/**
 * Check GitHub twice a day (unless turned off), and check our own folder every minute: when the
 * updater (or the user) has put a newer build there, reload into it.
 */
export function registerUpdateChecks(isBusy: () => boolean): void {
  void browser.alarms.create(ALARM, { periodInMinutes: INTERVAL_HOURS * 60, delayInMinutes: 1 });
  void browser.alarms.create(DISK_ALARM, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void checkForUpdate();
    if (alarm.name === DISK_ALARM) void reloadIfNewerOnDisk(isBusy);
  });
  void reloadIfNewerOnDisk(isBusy);
}

/** Version of the build currently in the extension's folder, read fresh from disk. */
export async function versionOnDisk(): Promise<string | null> {
  try {
    // manifest.json isn't one of WXT's typed public paths, so build the URL from the extension root.
    const response = await fetch(new URL('manifest.json', browser.runtime.getURL('/')), { cache: 'no-store' });
    const manifest = (await response.json()) as { version?: unknown };
    return typeof manifest.version === 'string' ? manifest.version : null;
  } catch {
    // Mid-write or unreadable: try again on the next check.
    return null;
  }
}

/** Reload into a newer build on disk, unless an AI operation is running (then retry next minute). */
export async function reloadIfNewerOnDisk(isBusy: () => boolean): Promise<boolean> {
  const running = browser.runtime.getManifest().version;
  const disk = await versionOnDisk();
  if (!disk || compareVersions(disk, running) <= 0 || isBusy()) return false;
  await browser.storage.local.set({ [AUTO_UPDATED_KEY]: { from: running, to: disk, at: Date.now() } });
  browser.runtime.reload();
  return true;
}

export async function checkForUpdate({ force = false } = {}): Promise<AvailableUpdate | null> {
  const settings = await loadSettings();
  if (!settings.updateChecks && !force) return null;
  const stored = await browser.storage.local.get(CHECKED_KEY);
  const last = typeof stored[CHECKED_KEY] === 'number' ? stored[CHECKED_KEY] : 0;
  if (!force && Date.now() - last < INTERVAL_HOURS * 3_600_000) return currentUpdate();

  const update = await fetchUpdate(browser.runtime.getManifest().version);
  await browser.storage.local.set({ [CHECKED_KEY]: Date.now(), [UPDATE_KEY]: update });
  await showBadge(update);
  return update;
}

export async function currentUpdate(): Promise<AvailableUpdate | null> {
  const stored = await browser.storage.local.get(UPDATE_KEY);
  const update = stored[UPDATE_KEY] as AvailableUpdate | null | undefined;
  // After reloading a new build, a stored notice for this or an older version is stale.
  if (!update || update.version === browser.runtime.getManifest().version) return null;
  return update;
}

export async function showBadge(update: AvailableUpdate | null): Promise<void> {
  await browser.action.setBadgeText({ text: update ? '↑' : '' });
  if (update) await browser.action.setBadgeBackgroundColor({ color: '#2f6fde' });
  await browser.action.setTitle({ title: update ? `Helium Max (⌘K) · ${update.version} available` : 'Helium Max (⌘K)' });
}
