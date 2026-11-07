import { activeProvider } from '@/ai/active';
import { truncateToTokens } from '@/ai/budget';
import { completeJson } from '@/ai/client';
import { UserFacingError } from '@/shared/errors';
import type { PreviewStart } from '@/shared/messages';
import type { LinkPreview } from '@/shared/types';
import { domainOf, isHttpUrl } from '@/shared/url';
import { fetchPreviewHtml, fetchPreviewImage } from './fetch';
import { normalizePreviewUrl } from './guard';
import { PREVIEW_SYSTEM_PROMPT, cardFrom, previewSchema } from './prompt';
import { syncRegisteredScript } from '@/shared/registered-scripts';

const CACHE_KEY = 'preview:cache';
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_MAX = 100;
const PREVIEW_INPUT_TOKENS = 3_000;

/** e2e builds preview pages on the local fixture server; real builds never touch private hosts. */
const ALLOW_PRIVATE = import.meta.env.MODE.startsWith('e2e');

type CacheEntry = LinkPreview & { at: number };


/** First step: a cached preview, or the page HTML for the content script to parse (the worker has no DOM). */
export async function startPreview(url: string, signal?: AbortSignal): Promise<PreviewStart> {
  if (!isHttpUrl(url)) throw new UserFacingError('page-unavailable', 'Only web links can be previewed.');
  const cached = await readCache(url);
  if (cached) return { kind: 'done', preview: cached };

  const page = await fetchPreviewHtml(url, { signal, allowPrivate: ALLOW_PRIVATE });
  if (page.kind === 'html') return { kind: 'parse', html: page.html, finalUrl: page.finalUrl };
  const preview = { url, title: '', domain: domainOf(page.finalUrl), unavailable: page.reason };
  await writeCache(url, preview);
  return { kind: 'done', preview };
}

export interface ParsedPage {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  siteName: string;
  text: string;
  hasPasswordField: boolean;
  imageUrl?: string;
}

/** Second step: summarize what the content script extracted, or explain why not. */
export async function finishPreview(page: ParsedPage, signal?: AbortSignal): Promise<LinkPreview> {
  const base = { url: page.url, title: page.title, domain: page.siteName || domainOf(page.finalUrl) };
  let preview: LinkPreview;

  if (page.text.length < 200) {
    preview = { ...base, unavailable: page.hasPasswordField ? 'Looks like a sign-in page' : 'Not enough readable text' };
  } else if (page.hasPasswordField && page.text.length < 600) {
    // A password box plus almost no text is a sign-in wall; a login box beside an article is not.
    preview = { ...base, unavailable: 'Looks like a sign-in page' };
  } else {
    const { config, settings } = await activeProvider('previews');
    const { text } = truncateToTokens(page.text, Math.min(settings.maxInputTokens, PREVIEW_INPUT_TOKENS));
    const header = [`Title: ${page.title}`, `URL: ${page.finalUrl}`, page.description && `Description: ${page.description}`]
      .filter(Boolean)
      .join('\n');
    const result = await completeJson(
      config,
      {
        system: PREVIEW_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `<page>\n${header}\n\n${text}\n</page>` }],
        temperature: settings.temperature,
        maxOutputTokens: 300,
        signal,
      },
      previewSchema,
      { timeoutMs: 30_000 },
    );
    const card = cardFrom(result);
    preview =
      result.blocked || (!card.headline && card.facts.length === 0)
        ? { ...base, unavailable: result.blocked ? 'Sign-in, paywall or bot check' : 'Nothing to summarize' }
        : { ...base, ...card, imageUrl: page.imageUrl };
  }
  await writeCache(page.url, preview);
  return preview;
}

/** The preview's image as a data URL, or null when there's none or it can't be fetched safely. */
export function previewImage(url: string, signal?: AbortSignal): Promise<string | null> {
  return fetchPreviewImage(url, { signal, allowPrivate: ALLOW_PRIVATE });
}

async function readCache(url: string): Promise<LinkPreview | undefined> {
  const cache = await loadCache();
  const entry = cache[normalizePreviewUrl(url)];
  if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return undefined;
  const { at: _, ...preview } = entry;
  return preview;
}

/** Session storage only: previews vanish when the browser quits. Bounded to the newest entries. */
async function writeCache(url: string, preview: LinkPreview): Promise<void> {
  const cache = await loadCache();
  cache[normalizePreviewUrl(url)] = { ...preview, at: Date.now() };
  const entries = Object.entries(cache)
    .filter(([, entry]) => Date.now() - entry.at <= CACHE_TTL_MS)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, CACHE_MAX);
  await browser.storage.session.set({ [CACHE_KEY]: Object.fromEntries(entries) });
}

async function loadCache(): Promise<Record<string, CacheEntry>> {
  const stored = await browser.storage.session.get(CACHE_KEY);
  return (stored[CACHE_KEY] as Record<string, CacheEntry> | undefined) ?? {};
}

/** Register the hover script while previews are on. Chrome only injects it where site access was granted. */
export function syncLinkPreviewScript(enabled: boolean): Promise<void> {
  return syncRegisteredScript('link-preview', 'content-scripts/link-preview.js', enabled);
}
