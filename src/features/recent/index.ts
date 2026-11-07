import { UserFacingError } from "@/shared/errors";
import type { RecentPage } from "@/shared/types";
import { isHttpUrl } from "@/shared/url";

const LAST_KEY = "recent:last";
const DAYS = 30;
const LIMIT = 25;

export function hostOf(url: string | undefined): string | null {
  if (!url || !isHttpUrl(url)) return null;
  return new URL(url).hostname;
}

/** Sites to offer: the current tab's, then the pinned tabs' (Arc showed this on pinned tabs). */
export async function recentSites(
  currentTabId: number | undefined,
): Promise<string[]> {
  const current =
    currentTabId === undefined
      ? undefined
      : await browser.tabs.get(currentTabId).catch(() => undefined);
  const pinned = await browser.tabs.query({
    pinned: true,
    windowId: current?.windowId,
  });
  return [
    ...new Set(
      [hostOf(current?.url), ...pinned.map((tab) => hostOf(tab.url))].filter(
        (host): host is string => Boolean(host),
      ),
    ),
  ];
}

/** The newest pages visited on a site in the last month, one per address. */
export function pickRecent(
  items: { url?: string; title?: string; lastVisitTime?: number }[],
  host: string,
  exclude: string | undefined,
): RecentPage[] {
  const seen = new Set<string>();
  const pages: RecentPage[] = [];
  for (const item of [...items].sort(
    (a, b) => (b.lastVisitTime ?? 0) - (a.lastVisitTime ?? 0),
  )) {
    if (!item.url || hostOf(item.url) !== host) continue;
    const key = item.url.split("#")[0]!;
    if (seen.has(key) || key === exclude?.split("#")[0]) continue;
    seen.add(key);
    pages.push({
      url: item.url,
      title: item.title || new URL(item.url).pathname,
      visitedAt: item.lastVisitTime ?? 0,
    });
    if (pages.length >= LIMIT) break;
  }
  return pages;
}

export async function recentPages(
  host: string,
  currentTabId: number | undefined,
): Promise<RecentPage[]> {
  if (!browser.history)
    throw new UserFacingError(
      "permission",
      "Turn on Recent Pages in Settings › Peeks first.",
    );
  const current =
    currentTabId === undefined
      ? undefined
      : await browser.tabs.get(currentTabId).catch(() => undefined);
  const items = await browser.history.search({
    text: host,
    startTime: Date.now() - DAYS * 86_400_000,
    maxResults: 1000,
  });
  const pages = pickRecent(items, host, current?.url);
  await browser.storage.session.set({
    [LAST_KEY]: pages.map((page) => page.url),
  });
  return pages;
}

/** Switch to the page if it's open, else open it beside the current tab. Only listed pages. */
export async function openRecent(
  url: string,
  currentTabId: number | undefined,
): Promise<void> {
  const allowed =
    ((await browser.storage.session.get(LAST_KEY))[LAST_KEY] as
      string[] | undefined) ?? [];
  if (!allowed.includes(url) || !isHttpUrl(url))
    throw new UserFacingError(
      "invalid-output",
      "That page is not in the list.",
    );
  const [open] = await browser.tabs.query({ url: url.split("#")[0] });
  if (open?.id !== undefined) {
    await browser.tabs.update(open.id, { active: true });
    await browser.windows.update(open.windowId, { focused: true });
    return;
  }
  const beside =
    currentTabId === undefined
      ? undefined
      : await browser.tabs.get(currentTabId).catch(() => undefined);
  await browser.tabs.create({
    url,
    active: true,
    windowId: beside?.windowId,
    index: beside ? beside.index + 1 : undefined,
  });
}
