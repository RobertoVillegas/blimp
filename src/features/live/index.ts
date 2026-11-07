import { UserFacingError } from "@/shared/errors";
import type { LiveFolderView, LiveItem } from "@/shared/types";
import { isHttpUrl } from "@/shared/url";
import { getApiKey } from "@/storage/secrets";
import { loadSettings, type Settings } from "@/storage/settings";
import { GITHUB_QUERIES, fetchFeed, fetchGithub } from "./sources";

export const GITHUB_TOKEN_ID = "github:token";
const STATE_KEY = "live:state";
const ALARM = "live-folders";
const STALE_MS = 5 * 60_000;

type FolderConfig = Settings["liveFolders"][number];
interface FolderState {
  items: LiveItem[];
  /** Item ids the user has seen or opened. */
  seen: string[];
  fetchedAt?: number;
  error?: string;
}
type State = Record<string, FolderState>;

async function loadState(): Promise<State> {
  return (
    ((await browser.storage.local.get(STATE_KEY))[STATE_KEY] as
      State | undefined) ?? {}
  );
}

async function saveState(state: State): Promise<void> {
  await browser.storage.local.set({ [STATE_KEY]: state });
}

/** e2e builds read GitHub from the fixture server. */
async function githubBase(): Promise<string | undefined> {
  if (!import.meta.env.MODE.startsWith("e2e")) return undefined;
  return (await browser.storage.local.get("e2e:githubApi"))["e2e:githubApi"] as
    string | undefined;
}

async function fetchFolder(folder: FolderConfig): Promise<LiveItem[]> {
  if (folder.kind === "github") {
    const query =
      folder.query in GITHUB_QUERIES
        ? GITHUB_QUERIES[folder.query as keyof typeof GITHUB_QUERIES].q
        : folder.query;
    return fetchGithub(query, await getApiKey(GITHUB_TOKEN_ID), {
      base: await githubBase(),
    });
  }
  return (await fetchFeed(folder.url)).items;
}

/**
 * Refresh folders. A folder's first fetch marks everything as seen, so only what arrives later
 * shows as new, like Arc.
 */
export async function refreshLiveFolders({
  force = false,
  only,
}: { force?: boolean; only?: string } = {}): Promise<void> {
  const { liveFolders } = await loadSettings();
  const state = await loadState();
  await Promise.all(
    liveFolders
      .filter((folder) => !only || folder.id === only)
      .map(async (folder) => {
        const current = state[folder.id];
        if (
          !force &&
          current?.fetchedAt &&
          Date.now() - current.fetchedAt < STALE_MS
        )
          return;
        try {
          const items = await fetchFolder(folder);
          const first = !current?.fetchedAt;
          const seen = first
            ? items.map((item) => item.id)
            : (current?.seen ?? []).slice(-500);
          state[folder.id] = { items, seen, fetchedAt: Date.now() };
        } catch (error) {
          state[folder.id] = {
            ...(current ?? { items: [], seen: [] }),
            fetchedAt: Date.now(),
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
  );
  // Drop state of folders that were removed.
  for (const id of Object.keys(state))
    if (!liveFolders.some((folder) => folder.id === id)) delete state[id];
  await saveState(state);
}

export async function listLiveFolders(): Promise<LiveFolderView[]> {
  const { liveFolders } = await loadSettings();
  const state = await loadState();
  return liveFolders.map((folder) => {
    const current = state[folder.id] ?? { items: [], seen: [] };
    const seen = new Set(current.seen);
    const items = current.items.map((item) => ({
      ...item,
      unread: !seen.has(item.id),
    }));
    return {
      id: folder.id,
      name: folder.name,
      kind: folder.kind,
      items,
      unread: items.filter((item) => item.unread).length,
      fetchedAt: current.fetchedAt,
      error: current.error,
    };
  });
}

export async function markSeen(
  folderId: string,
  itemIds: string[],
): Promise<void> {
  const state = await loadState();
  const current = state[folderId];
  if (!current) return;
  current.seen = [...new Set([...current.seen, ...itemIds])].slice(-500);
  await saveState(state);
}

/** Open items, but only ones the folder actually contains. */
export async function openLiveItems(
  folderId: string,
  itemIds: string[],
  besideTabId: number | undefined,
): Promise<void> {
  const state = await loadState();
  const items = (state[folderId]?.items ?? [])
    .filter((item) => itemIds.includes(item.id) && isHttpUrl(item.url))
    .slice(0, 10);
  if (items.length !== itemIds.length)
    throw new UserFacingError(
      "invalid-output",
      "Those items are no longer in the folder.",
    );
  const beside =
    besideTabId === undefined
      ? undefined
      : await browser.tabs.get(besideTabId).catch(() => undefined);
  for (const [i, item] of items.entries()) {
    await browser.tabs.create({
      url: item.url,
      active: i === 0,
      windowId: beside?.windowId,
      index: beside ? beside.index + 1 + i : undefined,
    });
  }
  await markSeen(folderId, itemIds);
}

export function registerLiveFolders(): void {
  void browser.alarms.create(ALARM, { periodInMinutes: 30, delayInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void refreshLiveFolders({ force: true });
  });
}
