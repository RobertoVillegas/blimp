/**
 * What the palette learns, Arc-style: how often each command is used, and which result the user
 * picks for what they type. Scores decay with a one-week half-life, so habits can change.
 */
export const HALF_LIFE_MS = 7 * 86_400_000;
const MAX_QUERIES = 300;
const MAX_KEYS_PER_QUERY = 5;

export interface Usage {
  score: number;
  at: number;
}

export interface RankData {
  commands: Record<string, Usage>;
  /** Normalized query → item key → usage. */
  picks: Record<string, Record<string, Usage>>;
}

export const emptyRank = (): RankData => ({ commands: {}, picks: {} });

export function decayed(usage: Usage | undefined, now: number): number {
  if (!usage) return 0;
  return usage.score * 0.5 ** (Math.max(0, now - usage.at) / HALF_LIFE_MS);
}

function bump(usage: Usage | undefined, now: number): Usage {
  return { score: decayed(usage, now) + 1, at: now };
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Record a use: a command run, and (when something was typed) what was picked for it. */
export function record(data: RankData, { key, command, query }: { key: string; command?: string; query?: string }, now: number): RankData {
  const next: RankData = { commands: { ...data.commands }, picks: { ...data.picks } };
  if (command) next.commands[command] = bump(next.commands[command], now);
  const q = query ? normalizeQuery(query) : '';
  if (q) {
    const forQuery = { ...(next.picks[q] ?? {}) };
    forQuery[key] = bump(forQuery[key], now);
    // Keep the strongest few keys per query, and the most recent queries.
    next.picks[q] = Object.fromEntries(Object.entries(forQuery).sort((a, b) => decayed(b[1], now) - decayed(a[1], now)).slice(0, MAX_KEYS_PER_QUERY));
    const queries = Object.entries(next.picks).sort((a, b) => Math.max(...Object.values(b[1]).map((u) => u.at)) - Math.max(...Object.values(a[1]).map((u) => u.at)));
    next.picks = Object.fromEntries(queries.slice(0, MAX_QUERIES));
  }
  return next;
}

/**
 * How strongly `key` was picked for this query. Picks for a longer query count for its prefixes
 * too ("gm" learns from "gmail"), at half weight, like typing toward a habit.
 */
export function pickScore(data: RankData, query: string, key: string, now: number): number {
  const q = normalizeQuery(query);
  if (!q) return 0;
  let score = decayed(data.picks[q]?.[key], now);
  for (const [stored, keys] of Object.entries(data.picks)) {
    if (stored !== q && stored.startsWith(q)) score += decayed(keys[key], now) / 2;
  }
  return score;
}

/** Move learned picks to the front (strongest first); everything else keeps its order. */
export function promotePicks<T>(items: T[], keyOf: (item: T) => string | null, data: RankData, query: string, now: number): T[] {
  const scored = items.map((item, index) => {
    const key = keyOf(item);
    return { item, index, score: key ? pickScore(data, query, key, now) : 0 };
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.item);
}

/** Commands by how much they're used; never-used ones keep the default order after them. */
export function byUsage<T extends { id: string }>(commands: T[], data: RankData, now: number): T[] {
  return commands
    .map((command, index) => ({ command, index, score: decayed(data.commands[command.id], now) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.command);
}
