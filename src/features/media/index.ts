import type { NowPlaying } from "@/shared/types";
import { canInjectInto, originPattern } from "@/shared/url";
import { controlMedia, type MediaAction, type PageMedia } from "./page";

/**
 * Tabs with something playing: everything the browser reports as audible, plus the tab the
 * palette is on (a muted video there still counts). Playback details need access to the site;
 * without it the tab still shows with mute and go-to-tab.
 */
export async function nowPlaying(
  currentTabId: number | undefined,
): Promise<NowPlaying[]> {
  const audible = await browser.tabs.query({ audible: true });
  const current =
    currentTabId === undefined
      ? undefined
      : await browser.tabs.get(currentTabId).catch(() => undefined);
  const tabs =
    current && !audible.some((tab) => tab.id === current.id)
      ? [current, ...audible]
      : audible;

  const result: NowPlaying[] = [];
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    const media = canInjectInto(tab.url)
      ? await run(tab.id, "state")
      : undefined;
    // The palette's own tab only shows when it actually has media.
    if (tab.id === current?.id && !tab.audible && !media) continue;
    result.push({
      ...toNowPlaying(tab, media),
      current: tab.id === current?.id,
    });
  }
  return result;
}

export async function mediaAction(
  tabId: number,
  action: Exclude<MediaAction, "state"> | "mute",
  currentTabId: number | undefined,
): Promise<NowPlaying | null> {
  return {
    ...(await applyMediaAction(tabId, action)),
    current: tabId === currentTabId,
  };
}

async function applyMediaAction(
  tabId: number,
  action: Exclude<MediaAction, "state"> | "mute",
) {
  const tab = await browser.tabs.get(tabId);
  if (action === "mute") {
    const updated = await browser.tabs.update(tabId, {
      muted: !tab.mutedInfo?.muted,
    });
    return toNowPlaying(
      updated ?? tab,
      canInjectInto(tab.url) ? await run(tabId, "state") : undefined,
    );
  }
  const media = await run(tabId, action);
  return toNowPlaying(tab, media);
}

/** undefined: no access to the page; null: accessible but nothing playing. */
async function run(
  tabId: number,
  action: MediaAction,
): Promise<PageMedia | null | undefined> {
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId },
      func: controlMedia,
      args: [action],
    });
    return (result?.result as PageMedia | null | undefined) ?? null;
  } catch {
    return undefined;
  }
}

function toNowPlaying(
  tab: Browser.tabs.Tab,
  media: PageMedia | null | undefined,
): Omit<NowPlaying, "current"> {
  return {
    tabId: tab.id!,
    title: media?.title || tab.title || "Playing",
    artist: media?.artist || "",
    artworkUrl: media?.artworkUrl || "",
    favIconUrl: tab.favIconUrl,
    playing: media ? media.playing : Boolean(tab.audible),
    muted: Boolean(tab.mutedInfo?.muted),
    hasVideo: Boolean(media?.hasVideo),
    canSkip: Boolean(media?.canSkip),
    controllable: media !== undefined,
    accessOrigin:
      media === undefined
        ? (originPattern(tab.url ?? "") ?? undefined)
        : undefined,
  };
}
