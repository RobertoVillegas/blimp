import { activeProvider, aiStatus } from '@/ai/active';
import { completeJson } from '@/ai/client';
import { UserFacingError } from '@/shared/errors';
import type { InstantLinksResult } from '@/shared/types';
import { isHttpUrl } from '@/shared/url';
import { getApiKey } from '@/storage/secrets';
import { loadSettings } from '@/storage/settings';
import { SEARCH_PROVIDERS, searchWeb } from './adapters';
import { RANK_SYSTEM_PROMPT, bestIndex, rankPrompt, rankSchema } from './rank';

const LAST_RESULTS_KEY = 'instant:last';
export const SEARCH_KEY_ID = 'search:brave';

export async function instantSearch(query: string, signal?: AbortSignal): Promise<InstantLinksResult> {
  const settings = await loadSettings();
  const provider = settings.search.provider;
  if (provider === 'none') return { configured: false, providerLabel: '', results: [], best: null };

  const info = SEARCH_PROVIDERS[provider];
  const results = await searchWeb({
    provider,
    query,
    baseUrl: settings.search.baseUrl,
    apiKey: provider === 'brave' ? await getApiKey(SEARCH_KEY_ID) : undefined,
    signal,
  });
  await browser.storage.session.set({ [LAST_RESULTS_KEY]: results.map((result) => result.url) });
  if (results.length === 0) return { configured: true, providerLabel: info.label, results, best: null, note: 'No results.' };

  // Ranking is a bonus: if the model is missing or fails, show the search engine's order.
  const status = await aiStatus();
  if (!status.configured || results.length < 2) {
    return { configured: true, providerLabel: info.label, results, best: 0 };
  }
  try {
    const { config } = await activeProvider();
    const ranked = await completeJson(
      config,
      {
        system: RANK_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: rankPrompt(query, results) }],
        temperature: 0,
        maxOutputTokens: 200,
        signal,
      },
      rankSchema,
      { timeoutMs: 20_000 },
    );
    return {
      configured: true,
      providerLabel: info.label,
      results,
      best: bestIndex(ranked.best, results.length),
      note: ranked.why || undefined,
      rankedBy: status.profileName,
    };
  } catch (error) {
    signal?.throwIfAborted();
    return {
      configured: true,
      providerLabel: info.label,
      results,
      best: 0,
      note: `Showing ${info.label}'s order; AI ranking failed (${error instanceof Error ? error.message : 'unknown error'}).`,
    };
  }
}

/** Open a result, but only one the search adapter actually returned. */
export async function openResult(url: string, besideTabId: number | undefined): Promise<void> {
  const stored = await browser.storage.session.get(LAST_RESULTS_KEY);
  const allowed = (stored[LAST_RESULTS_KEY] as string[] | undefined) ?? [];
  if (!isHttpUrl(url) || !allowed.includes(url)) {
    throw new UserFacingError('invalid-output', 'That link did not come from the search results, so it was not opened.');
  }
  const beside = besideTabId === undefined ? undefined : await browser.tabs.get(besideTabId).catch(() => undefined);
  await browser.tabs.create({ url, active: true, index: beside ? beside.index + 1 : undefined, windowId: beside?.windowId });
}

/** No search adapter: hand the query to the browser's own default search engine. */
export async function browserSearch(query: string): Promise<void> {
  await browser.search.query({ text: query, disposition: 'NEW_TAB' });
}
