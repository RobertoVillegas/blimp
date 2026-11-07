import { activeProvider, aiStatus } from "@/ai/active";
import { completeJson } from "@/ai/client";
import { UserFacingError } from "@/shared/errors";
import type { InstantLinksResult } from "@/shared/types";
import { isHttpUrl } from "@/shared/url";
import { getApiKey } from "@/storage/secrets";
import { loadSettings } from "@/storage/settings";
import { SEARCH_PROVIDERS, searchWeb } from "./adapters";
import {
  INTENT_SYSTEM_PROMPT,
  actionLink,
  intentSchema,
  type IntentAction,
} from "./intents";
import { RANK_SYSTEM_PROMPT, bestIndex, rankPrompt, rankSchema } from "./rank";

const LAST_RESULTS_KEY = "instant:last";
export const SEARCH_KEY_ID = "search:brave";

export async function instantSearch(
  query: string,
  signal?: AbortSignal,
): Promise<InstantLinksResult> {
  const settings = await loadSettings();
  const provider = settings.search.provider;
  const status = await aiStatus("instant");

  // Step 1, like Arc: what does the user want? Without AI, or if it fails, it's a plain web search.
  const intent = status.configured ? await parseIntent(query, signal) : null;
  const actions: IntentAction[] = intent?.actions ?? [{ type: "web", query }];
  const shortcuts = actions
    .map(actionLink)
    .filter((link): link is { label: string; url: string } => link !== null);
  const web = actions.find((action) => action.type === "web");
  const base: InstantLinksResult = {
    configured: provider !== "none",
    providerLabel: provider === "none" ? "" : SEARCH_PROVIDERS[provider].label,
    results: [],
    best: null,
    shortcuts,
    webRequested: Boolean(web),
    navigate: intent?.navigate ?? false,
    openCount: Math.min(5, web?.count ?? 1),
    searchQuery: web?.query || query,
  };

  if (!web || provider === "none") {
    await rememberAllowed(shortcuts.map((link) => link.url));
    return base;
  }

  const results = await searchWeb({
    provider,
    query: base.searchQuery!,
    baseUrl: settings.search.baseUrl,
    apiKey: provider === "brave" ? await getApiKey(SEARCH_KEY_ID) : undefined,
    signal,
  });
  await rememberAllowed([
    ...results.map((result) => result.url),
    ...shortcuts.map((link) => link.url),
  ]);
  if (results.length === 0) return { ...base, results, note: "No results." };

  // Step 2: rank. A bonus: if the model is missing or fails, show the search engine's order.
  if (!status.configured || results.length < 2)
    return { ...base, results, best: 0 };
  try {
    const { config } = await activeProvider("instant");
    const ranked = await completeJson(
      config,
      {
        system: RANK_SYSTEM_PROMPT,
        messages: [{ role: "user", content: rankPrompt(query, results) }],
        temperature: 0,
        maxOutputTokens: 200,
        signal,
      },
      rankSchema,
      { timeoutMs: 20_000 },
    );
    return {
      ...base,
      results,
      best: bestIndex(ranked.best, results.length),
      note: ranked.why || undefined,
      rankedBy: status.profileName,
    };
  } catch (error) {
    signal?.throwIfAborted();
    return {
      ...base,
      results,
      best: 0,
      note: `Showing ${base.providerLabel}'s order; AI ranking failed (${error instanceof Error ? error.message : "unknown error"}).`,
    };
  }
}

async function parseIntent(query: string, signal?: AbortSignal) {
  try {
    const { config } = await activeProvider("instant");
    return await completeJson(
      config,
      {
        system: INTENT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: query }],
        temperature: 0,
        maxOutputTokens: 400,
        signal,
      },
      intentSchema,
      { timeoutMs: 15_000 },
    );
  } catch {
    signal?.throwIfAborted();
    return null;
  }
}

/** Only URLs from the search provider or our own templates may be opened afterwards. */
export async function rememberAllowed(urls: string[]): Promise<void> {
  await browser.storage.session.set({ [LAST_RESULTS_KEY]: urls });
}

/** Open several results at once, only after the user pressed the button for it. */
export async function openResults(
  urls: string[],
  besideTabId: number | undefined,
): Promise<void> {
  const stored = await browser.storage.session.get(LAST_RESULTS_KEY);
  const allowed = new Set(
    (stored[LAST_RESULTS_KEY] as string[] | undefined) ?? [],
  );
  const safe = urls
    .filter((url) => isHttpUrl(url) && allowed.has(url))
    .slice(0, 5);
  if (safe.length !== urls.length)
    throw new UserFacingError(
      "invalid-output",
      "Some links did not come from the search results; nothing was opened.",
    );
  const beside =
    besideTabId === undefined
      ? undefined
      : await browser.tabs.get(besideTabId).catch(() => undefined);
  for (const [i, url] of safe.entries()) {
    await browser.tabs.create({
      url,
      active: i === 0,
      index: beside ? beside.index + 1 + i : undefined,
      windowId: beside?.windowId,
    });
  }
}

/** Open a result, but only one the search adapter actually returned. */
export async function openResult(
  url: string,
  besideTabId: number | undefined,
): Promise<void> {
  const stored = await browser.storage.session.get(LAST_RESULTS_KEY);
  const allowed = (stored[LAST_RESULTS_KEY] as string[] | undefined) ?? [];
  if (!isHttpUrl(url) || !allowed.includes(url)) {
    throw new UserFacingError(
      "invalid-output",
      "That link did not come from the search results, so it was not opened.",
    );
  }
  const beside =
    besideTabId === undefined
      ? undefined
      : await browser.tabs.get(besideTabId).catch(() => undefined);
  await browser.tabs.create({
    url,
    active: true,
    index: beside ? beside.index + 1 : undefined,
    windowId: beside?.windowId,
  });
}

/** No search adapter: hand the query to the browser's own default search engine. */
export async function browserSearch(query: string): Promise<void> {
  await browser.search.query({ text: query, disposition: "NEW_TAB" });
}
