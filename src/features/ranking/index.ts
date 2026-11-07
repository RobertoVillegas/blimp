import { emptyRank, record, type RankData } from "./score";

const KEY = "rank:data";

export async function loadRank(): Promise<RankData> {
  return (
    ((await browser.storage.local.get(KEY))[KEY] as RankData | undefined) ??
    emptyRank()
  );
}

export async function recordUse(use: {
  key: string;
  command?: string;
  query?: string;
}): Promise<void> {
  await browser.storage.local.set({
    [KEY]: record(await loadRank(), use, Date.now()),
  });
}

export async function clearRank(): Promise<void> {
  await browser.storage.local.remove(KEY);
}
