import type { ArchivedTab } from "@/shared/types";
import { isHttpUrl } from "@/shared/url";
import { loadSettings } from "@/storage/settings";
import { ARCHIVE_AFTER, staleTabs } from "./select";

const ENTRIES_KEY = "archive:entries";
const ALARM = "auto-archive";
const MAX_ENTRIES = 300;
const KEEP_MS = 30 * 86_400_000;

async function load(): Promise<ArchivedTab[]> {
  return (
    ((await browser.storage.local.get(ENTRIES_KEY))[ENTRIES_KEY] as
      ArchivedTab[] | undefined) ?? []
  );
}

async function save(entries: ArchivedTab[]): Promise<void> {
  const cutoff = Date.now() - KEEP_MS;
  await browser.storage.local.set({
    [ENTRIES_KEY]: entries
      .filter((entry) => entry.archivedAt >= cutoff)
      .slice(0, MAX_ENTRIES),
  });
}

/** Close tabs nobody has used for the chosen time, keeping them in the archive to reopen. */
export async function runAutoArchive(now = Date.now()): Promise<number> {
  const settings = await loadSettings();
  const maxAge = ARCHIVE_AFTER[settings.autoArchive];
  if (!maxAge) return 0;
  const tabs = await browser.tabs.query({ windowType: "normal" });
  const stale = staleTabs(tabs, now, maxAge);
  if (stale.length === 0) return 0;
  const archived: ArchivedTab[] = stale.map((tab) => ({
    id: crypto.randomUUID(),
    url: tab.url!,
    title: tab.title || tab.url!,
    favIconUrl: tab.favIconUrl?.startsWith("https:")
      ? tab.favIconUrl
      : undefined,
    archivedAt: now,
  }));
  // Save first: a tab is only closed once it's safely in the archive.
  await save([...archived, ...(await load())]);
  await browser.tabs.remove(stale.map((tab) => tab.id!));
  return stale.length;
}

export function registerAutoArchive(): void {
  void browser.alarms.create(ALARM, { periodInMinutes: 15 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void runAutoArchive();
  });
}

export async function listArchive(): Promise<ArchivedTab[]> {
  const cutoff = Date.now() - KEEP_MS;
  return (await load()).filter((entry) => entry.archivedAt >= cutoff);
}

/** Reopen an archived tab next to the one the user is on and drop it from the archive. */
export async function restoreArchived(
  id: string,
  besideTabId: number | undefined,
): Promise<void> {
  const entries = await load();
  const entry = entries.find((item) => item.id === id);
  if (!entry || !isHttpUrl(entry.url)) return;
  const beside =
    besideTabId === undefined
      ? undefined
      : await browser.tabs.get(besideTabId).catch(() => undefined);
  await browser.tabs.create({
    url: entry.url,
    active: true,
    windowId: beside?.windowId,
    index: beside ? beside.index + 1 : undefined,
  });
  await save(entries.filter((item) => item.id !== id));
}

export async function clearArchive(): Promise<void> {
  await browser.storage.local.remove(ENTRIES_KEY);
}
