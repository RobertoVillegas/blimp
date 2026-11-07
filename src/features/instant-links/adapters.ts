import { joinUrl } from "@/ai/providers/http";
import { UserFacingError } from "@/shared/errors";
import type { SearchCandidate } from "@/shared/types";
import { isHttpUrl, isSecureEndpoint } from "@/shared/url";

export type SearchProviderId = "brave" | "searxng";

export const SEARCH_PROVIDERS: Record<
  SearchProviderId,
  { label: string; needsKey: boolean; defaultBaseUrl: string; keyUrl?: string }
> = {
  brave: {
    label: "Brave Search API",
    needsKey: true,
    defaultBaseUrl: "https://api.search.brave.com",
    keyUrl: "https://api-dashboard.search.brave.com/app/keys",
  },
  searxng: { label: "SearXNG", needsKey: false, defaultBaseUrl: "" },
};

export const MAX_RESULTS = 8;

export interface SearchRequest {
  provider: SearchProviderId;
  query: string;
  baseUrl: string;
  apiKey?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/** Real search results only. Non-web URLs are dropped and duplicates collapsed. */
export async function searchWeb({
  provider,
  query,
  baseUrl,
  apiKey,
  signal,
  fetchImpl = fetch,
}: SearchRequest): Promise<SearchCandidate[]> {
  const info = SEARCH_PROVIDERS[provider];
  const base = baseUrl || info.defaultBaseUrl;
  if (!base)
    throw new UserFacingError(
      "not-configured",
      `Set the ${info.label} URL in AI Settings.`,
    );
  if (!isSecureEndpoint(base))
    throw new UserFacingError(
      "not-configured",
      `The ${info.label} address must use https:// (or be on localhost).`,
    );
  if (info.needsKey && !apiKey)
    throw new UserFacingError(
      "not-configured",
      `Add your ${info.label} key in AI Settings.`,
    );

  const url =
    provider === "brave"
      ? `${joinUrl(base, "res/v1/web/search")}?${new URLSearchParams({ q: query, count: "10" })}`
      : `${joinUrl(base, "search")}?${new URLSearchParams({ q: query, format: "json" })}`;
  const headers: Record<string, string> = { accept: "application/json" };
  if (provider === "brave") headers["x-subscription-token"] = apiKey!;

  const timeout = AbortSignal.timeout(10_000);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers,
      credentials: "omit",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    signal?.throwIfAborted();
    throw new UserFacingError("network", `Could not reach ${info.label}.`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new UserFacingError(
      "auth",
      provider === "searxng"
        ? "SearXNG refused the request. Enable the JSON format in its settings (search.formats)."
        : `${info.label} rejected the key.`,
    );
  }
  if (response.status === 429)
    throw new UserFacingError("quota", `${info.label} rate limit reached.`);
  if (!response.ok)
    throw new UserFacingError(
      "network",
      `${info.label} returned HTTP ${response.status}.`,
    );

  const body = (await response.json().catch(() => null)) as {
    web?: { results?: RawResult[] };
    results?: RawResult[];
  } | null;
  const raw = (provider === "brave" ? body?.web?.results : body?.results) ?? [];
  return toCandidates(raw);
}

interface RawResult {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  content?: unknown;
}

export function toCandidates(raw: RawResult[]): SearchCandidate[] {
  const seen = new Set<string>();
  const results: SearchCandidate[] = [];
  for (const item of raw) {
    if (typeof item.url !== "string" || !isHttpUrl(item.url)) continue;
    const key = item.url.replace(/#.*$/, "").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      title: plain(item.title) || new URL(item.url).hostname,
      url: item.url,
      snippet: plain(item.description ?? item.content).slice(0, 300),
    });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

/** Brave marks matches with <strong>; results are rendered as text, so strip tags and entities. */
function plain(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(amp|lt|gt|quot|#39|nbsp);/g,
      (_, entity: string) =>
        ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " })[
          entity
        ] ?? "",
    )
    .replace(/\s+/g, " ")
    .trim();
}
