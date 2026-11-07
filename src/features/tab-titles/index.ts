import { activeProvider } from "@/ai/active";
import { completeJson } from "@/ai/client";
import { UserFacingError } from "@/shared/errors";
import type { TitleProposal } from "@/shared/types";
import { canInjectInto, originPattern } from "@/shared/url";
import { keepTitle } from "./keeper";
import {
  TITLES_SYSTEM_PROMPT,
  cleanTabTitle,
  titlesSchema,
  titlesUserPrompt,
} from "./prompt";

/** Saved names, by page (origin + path), so they come back after reloads and restarts. */
const STORE_KEY = "tabTitles";
type Store = Record<string, string>;

export function titleKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? `${parsed.origin}${parsed.pathname}`
      : null;
  } catch {
    return null;
  }
}

async function loadStore(): Promise<Store> {
  return (
    ((await browser.storage.local.get(STORE_KEY))[STORE_KEY] as
      Store | undefined) ?? {}
  );
}

async function saveStore(store: Store): Promise<void> {
  await browser.storage.local.set({ [STORE_KEY]: store });
}

/** Names proposed by the model for the pinned tabs in a window. Nothing changes until applied. */
export async function proposeTitles(
  windowId: number,
  signal?: AbortSignal,
): Promise<TitleProposal[]> {
  const tabs = (await browser.tabs.query({ windowId, pinned: true })).filter(
    (tab) => tab.id !== undefined && canInjectInto(tab.url),
  );
  if (tabs.length === 0) {
    throw new UserFacingError(
      "nothing-to-do",
      "There are no pinned web pages in this window. Pin some tabs, or use Rename Tab on any tab.",
    );
  }
  const store = await loadStore();
  const originals = await Promise.all(tabs.map((tab) => originalTitle(tab)));
  const { config, settings } = await activeProvider("tidy");
  const result = await completeJson(
    config,
    {
      system: TITLES_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: titlesUserPrompt(
            tabs.map((tab, i) => ({
              title: originals[i]!,
              url: tab.url ?? "",
            })),
          ),
        },
      ],
      temperature: settings.temperature,
      maxOutputTokens: 600,
      signal,
    },
    titlesSchema,
  );
  return tabs.map((tab, i) => {
    const proposed = cleanTabTitle(
      result.titles.find((item) => item.tab === i + 1)?.title ?? "",
    );
    return {
      tabId: tab.id!,
      url: tab.url ?? "",
      favIconUrl: tab.favIconUrl,
      original: originals[i]!,
      current: store[titleKey(tab.url ?? "") ?? ""],
      proposed: proposed || originals[i]!,
    };
  });
}

/**
 * Show these names now (the palette's tab is readable through activeTab) and remember them.
 * Returns the site access still needed for the names to survive reloads.
 */
export async function applyTitles(
  items: { tabId: number; title: string }[],
): Promise<string[]> {
  const store = await loadStore();
  const missing = new Set<string>();
  for (const item of items) {
    const tab = await browser.tabs.get(item.tabId).catch(() => undefined);
    const key = tab?.url ? titleKey(tab.url) : null;
    const title = cleanTabTitle(item.title);
    if (!tab || !key || !title) continue;
    store[key] = title;
    const injected = await inject(item.tabId, title);
    const pattern = originPattern(tab.url!);
    if (
      !injected ||
      (pattern && !(await browser.permissions.contains({ origins: [pattern] })))
    ) {
      if (pattern) missing.add(pattern);
    }
  }
  await saveStore(store);
  return [...missing];
}

/** Forget names and give tabs their sites' titles back. */
export async function restoreTitles(tabIds: number[]): Promise<number> {
  const store = await loadStore();
  let restored = 0;
  for (const tabId of tabIds) {
    const tab = await browser.tabs.get(tabId).catch(() => undefined);
    const key = tab?.url ? titleKey(tab.url) : null;
    if (!key || !(key in store)) continue;
    delete store[key];
    restored++;
    await inject(tabId, null);
  }
  await saveStore(store);
  return restored;
}

/** Re-apply a saved name when a page loads. Silent when the site isn't accessible. */
export function registerTitleKeeper(): void {
  browser.tabs.onUpdated.addListener(async (tabId, change, tab) => {
    if (change.status !== "complete" || !tab.url) return;
    const key = titleKey(tab.url);
    if (!key) return;
    const title = (await loadStore())[key];
    if (title) await inject(tabId, title);
  });
}

async function inject(tabId: number, title: string | null): Promise<boolean> {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: keepTitle,
      args: [title],
    });
    return true;
  } catch {
    return false;
  }
}

/** The site's own title, even if we renamed the tab earlier. */
async function originalTitle(tab: Browser.tabs.Tab): Promise<string> {
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () =>
        (globalThis as unknown as { __heliumMaxTitle?: { original: string } })
          .__heliumMaxTitle?.original ?? document.title,
    });
    if (typeof result?.result === "string") return result.result;
  } catch {
    // No access: the tab strip title is the best we have.
  }
  return tab.title ?? "";
}
