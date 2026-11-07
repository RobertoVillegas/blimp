import { UserFacingError } from "@/shared/errors";
import type { LiveItem } from "@/shared/types";
import { isHttpUrl } from "@/shared/url";

const MAX_ITEMS = 30;

// ---- RSS 2.0 and Atom ----

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (/^#x/i.test(entity))
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#"))
        return String.fromCodePoint(Number(entity.slice(1)));
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml: string, name: string): string {
  const match = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,
    "i",
  ).exec(xml);
  return match ? decode(match[1]!) : "";
}

/**
 * Items from an RSS 2.0 or Atom feed. The service worker has no DOMParser, and feeds are a small,
 * regular format, so a narrow parser is enough. Only http(s) links are kept.
 */
export function parseFeed(
  xml: string,
  feedUrl: string,
): { title: string; items: LiveItem[] } {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = [
    ...xml.matchAll(
      isAtom
        ? /<entry[\s>][\s\S]*?<\/entry>/gi
        : /<item[\s>][\s\S]*?<\/item>/gi,
    ),
  ].map((m) => m[0]);
  if (!blocks.length && !/<(rss|feed|rdf:RDF)[\s>]/i.test(xml))
    throw new UserFacingError(
      "invalid-output",
      "That address is not an RSS or Atom feed.",
    );
  const feedTitle = tag(
    xml.replace(/<(item|entry)[\s>][\s\S]*$/i, ""),
    "title",
  );

  const items: LiveItem[] = [];
  for (const block of blocks) {
    let link = "";
    if (isAtom) {
      const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map(
        (m) => m[1]!,
      );
      const alternate =
        links.find(
          (attrs) => !/rel=/.test(attrs) || /rel=["']alternate["']/.test(attrs),
        ) ??
        links[0] ??
        "";
      link = decode(/href=["']([^"']+)["']/.exec(alternate)?.[1] ?? "");
    } else {
      link =
        tag(block, "link") ||
        decode(
          /<guid[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i.exec(
            block,
          )?.[1] ?? "",
        );
    }
    try {
      link = new URL(link, feedUrl).href;
    } catch {
      continue;
    }
    if (!isHttpUrl(link)) continue;
    const date =
      tag(block, isAtom ? "updated" : "pubDate") ||
      tag(block, "published") ||
      tag(block, "dc:date");
    const time = Date.parse(date);
    items.push({
      id: tag(block, isAtom ? "id" : "guid") || link,
      title: tag(block, "title") || link,
      url: link,
      subtitle: author(block),
      date: Number.isFinite(time) ? new Date(time).toISOString() : "",
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return { title: feedTitle, items };
}

/** Atom's <author><name>, RSS's <author> or <dc:creator>. */
function author(block: string): string {
  const raw = /<author[\s>]([\s\S]*?)<\/author>/i.exec(block)?.[1] ?? "";
  return tag(raw, "name") || decode(raw) || tag(block, "dc:creator");
}

// ---- GitHub ----

export const GITHUB_QUERIES = {
  review: {
    label: "PRs waiting for my review",
    q: "is:open is:pr review-requested:@me archived:false",
  },
  mine: { label: "My open PRs", q: "is:open is:pr author:@me archived:false" },
  assigned: {
    label: "Issues and PRs assigned to me",
    q: "is:open assignee:@me archived:false",
  },
} as const;

export type GithubPreset = keyof typeof GITHUB_QUERIES;

export function githubSearchUrl(
  query: string,
  base = "https://api.github.com",
): string {
  return `${base}/search/issues?${new URLSearchParams({ q: query, sort: "updated", order: "desc", per_page: String(MAX_ITEMS) })}`;
}

interface GithubIssue {
  id?: unknown;
  title?: unknown;
  html_url?: unknown;
  number?: unknown;
  repository_url?: unknown;
  updated_at?: unknown;
  user?: { login?: unknown };
  pull_request?: unknown;
}

export function parseGithubSearch(body: unknown): LiveItem[] {
  const items = (body as { items?: GithubIssue[] })?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter(
      (item) =>
        typeof item.html_url === "string" &&
        /^https:\/\/github\.com\//.test(item.html_url),
    )
    .map((item) => {
      const repo =
        typeof item.repository_url === "string"
          ? item.repository_url.replace(/^.*\/repos\//, "")
          : "";
      const who =
        typeof item.user?.login === "string" ? ` · ${item.user.login}` : "";
      return {
        id: String(item.id ?? item.html_url),
        title:
          typeof item.title === "string" ? item.title : String(item.html_url),
        url: item.html_url as string,
        subtitle: `${repo}#${String(item.number ?? "")}${who}`,
        date: typeof item.updated_at === "string" ? item.updated_at : "",
      };
    });
}

export async function fetchGithub(
  query: string,
  token: string | undefined,
  { base, fetchImpl = fetch }: { base?: string; fetchImpl?: typeof fetch } = {},
): Promise<LiveItem[]> {
  if (!token)
    throw new UserFacingError(
      "not-configured",
      "Add a GitHub token in Settings › Live Folders.",
    );
  let response: Response;
  try {
    response = await fetchImpl(githubSearchUrl(query, base), {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
      credentials: "omit",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new UserFacingError("network", "Could not reach GitHub.");
  }
  if (response.status === 401)
    throw new UserFacingError(
      "auth",
      "GitHub rejected the token. Create a new one in Settings › Live Folders.",
    );
  if (response.status === 403 || response.status === 429)
    throw new UserFacingError(
      "quota",
      "GitHub rate limit reached; it will refresh later.",
    );
  if (!response.ok)
    throw new UserFacingError(
      "network",
      `GitHub answered HTTP ${response.status}.`,
    );
  return parseGithubSearch(await response.json());
}

export async function fetchFeed(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ title: string; items: LiveItem[] }> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      credentials: "omit",
      headers: {
        accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new UserFacingError("network", "Could not reach the feed.");
  }
  if (!response.ok)
    throw new UserFacingError(
      "network",
      `The feed answered HTTP ${response.status}.`,
    );
  return parseFeed(
    (await response.text()).slice(0, 2_000_000),
    response.url || url,
  );
}
