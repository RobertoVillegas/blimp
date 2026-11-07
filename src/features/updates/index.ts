import { loadSettings } from '@/storage/settings';
import { fetchUpdate, type AvailableUpdate } from './check';

export const UPDATE_KEY = 'update:available';
const CHECKED_KEY = 'update:checkedAt';
const ALARM = 'update-check';
const INTERVAL_HOURS = 12;

/** Check now and then twice a day, unless the user turned update checks off. */
export function registerUpdateChecks(): void {
  void browser.alarms.create(ALARM, { periodInMinutes: INTERVAL_HOURS * 60, delayInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void checkForUpdate();
  });
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
