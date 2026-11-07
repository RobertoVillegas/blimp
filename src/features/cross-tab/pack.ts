import { truncateToTokens } from '@/ai/budget';

export interface TabDocument {
  tabId: number;
  title: string;
  url: string;
  text: string;
}

export interface PackedSource extends TabDocument {
  n: number;
  truncated: boolean;
}

export interface Packing {
  batches: PackedSource[][];
  /** Tabs that did not fit in any batch. */
  overflow: TabDocument[];
}

export const MAX_BATCHES = 4;
/** No single tab may take more than this share of one request. */
const MAX_TAB_TOKENS = 8_000;
const HEADER_TOKENS = 40;

/**
 * Number sources in reading order and pack them into at most `maxBatches` requests of
 * `batchTokens` each. One batch means a single answer call; more means map/reduce.
 */
export function packSources(docs: TabDocument[], batchTokens: number, maxBatches = MAX_BATCHES): Packing {
  const perTab = Math.min(MAX_TAB_TOKENS, batchTokens - HEADER_TOKENS);
  const batches: PackedSource[][] = [];
  const overflow: TabDocument[] = [];
  let used = 0;
  let n = 0;

  for (const doc of docs) {
    const { text, truncated } = truncateToTokens(doc.text, perTab);
    const cost = Math.ceil(text.length / 4) + HEADER_TOKENS;
    let batch = batches.at(-1);
    if (!batch || used + cost > batchTokens) {
      if (batches.length >= maxBatches) {
        overflow.push(doc);
        continue;
      }
      batch = [];
      batches.push(batch);
      used = 0;
    }
    batch.push({ ...doc, text, truncated, n: ++n });
    used += cost;
  }
  return { batches, overflow };
}

export function sourcesBlock(sources: PackedSource[]): string {
  return sources
    .map(
      (source) =>
        `<source n="${source.n}">\nTitle: ${source.title}\nURL: ${source.url}${source.truncated ? '\n(truncated)' : ''}\n\n${source.text}\n</source>`,
    )
    .join('\n\n');
}
