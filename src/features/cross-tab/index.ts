import { activeProvider } from "@/ai/active";
import { complete } from "@/ai/client";
import {
  extractPageContent,
  type ExtractedPage,
} from "@/features/ask-page/extract";
import { UserFacingError } from "@/shared/errors";
import type {
  CrossTabCandidate,
  CrossTabResult,
  CrossTabSkipped,
} from "@/shared/types";
import { originPattern } from "@/shared/url";
import { MAX_TABS, blockedReason, isAsleep } from "./classify";
import { packSources, sourcesBlock, type TabDocument } from "./pack";
import {
  CROSS_SYSTEM_PROMPT,
  MAP_SYSTEM_PROMPT,
  questionTask,
  reduceInput,
  summaryTask,
} from "./prompt";

const EXTRACT_TIMEOUT_MS = 6_000;
const MAX_CHARS_PER_TAB = 32_000;
const PARALLEL_READS = 4;
const WAKE_TIMEOUT_MS = 15_000;

export async function crossTabCandidates(
  windowId: number,
): Promise<CrossTabCandidate[]> {
  const ownPages = browser.runtime.getURL("/");
  const tabs = await browser.tabs.query({ windowId });
  return tabs
    .filter((tab) => tab.id !== undefined && !tab.url?.startsWith(ownPages))
    .map((tab) => ({
      tabId: tab.id!,
      title: tab.title || tab.url || "Untitled",
      url: tab.url ?? "",
      favIconUrl: tab.favIconUrl,
      active: tab.active,
      blocked: blockedReason({
        id: tab.id!,
        url: tab.url ?? "",
        discarded: tab.discarded,
        status: tab.status,
      }),
      asleep: isAsleep({
        id: tab.id!,
        url: tab.url ?? "",
        discarded: tab.discarded,
        status: tab.status,
      }),
    }));
}

/**
 * Site access patterns still needed to read these tabs. The tab the palette was opened on is
 * readable through activeTab, so it never needs a grant.
 */
export async function missingOrigins(
  tabIds: number[],
  currentTabId: number | undefined,
): Promise<string[]> {
  const patterns = new Set<string>();
  for (const tabId of tabIds) {
    if (tabId === currentTabId) continue;
    const tab = await browser.tabs.get(tabId).catch(() => undefined);
    const pattern = tab?.url ? originPattern(tab.url) : null;
    if (pattern) patterns.add(pattern);
  }
  const missing: string[] = [];
  for (const pattern of patterns) {
    if (!(await browser.permissions.contains({ origins: [pattern] })))
      missing.push(pattern);
  }
  return missing;
}

export async function runCrossTab(options: {
  windowId: number;
  tabIds: number[];
  question: string | null;
  /** The user asked to load sleeping tabs (in the background) so they can be read. */
  wake?: boolean;
  signal?: AbortSignal;
}): Promise<CrossTabResult> {
  const { config, settings } = await activeProvider("tabs");
  const skipped: CrossTabSkipped[] = [];
  const tabs: Browser.tabs.Tab[] = [];

  for (const tabId of options.tabIds) {
    const tab = await browser.tabs.get(tabId).catch(() => undefined);
    if (!tab) continue;
    const info = {
      tabId,
      title: tab.title || tab.url || "Untitled",
      url: tab.url ?? "",
    };
    const state = {
      id: tabId,
      url: info.url,
      discarded: tab.discarded,
      status: tab.status,
    };
    const blocked =
      options.wake && isAsleep(state)
        ? blockedReason({ ...state, discarded: false, status: "complete" })
        : blockedReason(state);
    if (tab.windowId !== options.windowId)
      skipped.push({ ...info, reason: "Moved to another window" });
    else if (blocked) skipped.push({ ...info, reason: blocked });
    else if (tabs.length >= MAX_TABS)
      skipped.push({ ...info, reason: `Over the ${MAX_TABS}-tab limit` });
    else tabs.push(tab);
  }

  const docs: TabDocument[] = [];
  await forEachLimited(tabs, PARALLEL_READS, async (tab) => {
    const info = {
      tabId: tab.id!,
      title: tab.title || tab.url || "Untitled",
      url: tab.url ?? "",
    };
    if (
      options.wake &&
      isAsleep({
        id: tab.id!,
        url: info.url,
        discarded: tab.discarded,
        status: tab.status,
      })
    ) {
      if (!(await wakeTab(tab.id!))) {
        skipped.push({
          ...info,
          reason: "Did not finish loading after waking",
        });
        return;
      }
    }
    const read = await readTab(tab.id!);
    if (typeof read === "string") skipped.push({ ...info, reason: read });
    else
      docs.push({ ...info, title: read.title || info.title, text: read.text });
  });
  options.signal?.throwIfAborted();

  // Keep the window's tab order so source numbers match what the user sees.
  const order = new Map(options.tabIds.map((id, index) => [id, index]));
  docs.sort((a, b) => order.get(a.tabId)! - order.get(b.tabId)!);
  if (docs.length === 0) {
    throw new UserFacingError(
      "page-unavailable",
      "None of the selected tabs could be read. See the reasons next to each tab.",
    );
  }

  const { batches, overflow } = packSources(docs, settings.maxInputTokens);
  for (const doc of overflow)
    skipped.push({
      ...doc,
      reason: "Did not fit the context budget (raise it in AI Settings)",
    });
  const sources = batches.flat();
  const task = options.question
    ? questionTask(options.question)
    : summaryTask(sources.length);
  const base = {
    temperature: settings.temperature,
    signal: options.signal,
    sessionId: crypto.randomUUID(),
  };

  let text: string;
  if (batches.length === 1) {
    text = await complete(config, {
      ...base,
      system: CROSS_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `${sourcesBlock(sources)}\n\n${task}` },
      ],
      maxOutputTokens: settings.maxOutputTokens,
    });
  } else {
    const notes = await Promise.all(
      batches.map((batch) =>
        complete(config, {
          ...base,
          system: MAP_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `${sourcesBlock(batch)}\n\nTask the notes are for: ${task}`,
            },
          ],
          maxOutputTokens: 700,
        }),
      ),
    );
    const index = sources
      .map((source) => `[${source.n}] ${source.title}`)
      .join("\n");
    text = await complete(config, {
      ...base,
      system: CROSS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Sources:\n${index}\n\n${reduceInput(task, notes)}`,
        },
      ],
      maxOutputTokens: settings.maxOutputTokens,
    });
  }

  return {
    text,
    sources: sources.map(({ n, tabId, title, url, truncated }) => ({
      n,
      tabId,
      title,
      url,
      truncated,
    })),
    skipped,
    calls: batches.length === 1 ? 1 : batches.length + 1,
  };
}

/** Load a discarded tab in place, without switching to it. Resolves false if it doesn't finish loading in time. */
async function wakeTab(tabId: number): Promise<boolean> {
  const loaded = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => finish(false), WAKE_TIMEOUT_MS);
    const listener = (id: number, change: Browser.tabs.OnUpdatedInfo) => {
      if (id === tabId && change.status === "complete") finish(true);
    };
    function finish(ok: boolean) {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      resolve(ok);
    }
    browser.tabs.onUpdated.addListener(listener);
  });
  await browser.tabs.reload(tabId);
  return loaded;
}

/** Extracted page, or the reason it couldn't be read. Never reloads or activates the tab. */
async function readTab(tabId: number): Promise<ExtractedPage | string> {
  const timeout = new Promise<string>((resolve) =>
    setTimeout(() => resolve("Timed out while reading"), EXTRACT_TIMEOUT_MS),
  );
  const read = browser.scripting
    .executeScript({
      target: { tabId },
      func: extractPageContent,
      args: [MAX_CHARS_PER_TAB],
    })
    .then(([result]) => {
      const page = result?.result as ExtractedPage | undefined;
      return page && page.text.length >= 40 ? page : "No readable text";
    })
    .catch(() => "No access to this site");
  return Promise.race([read, timeout]);
}

async function forEachLimited<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift())
        await run(item);
    }),
  );
}
