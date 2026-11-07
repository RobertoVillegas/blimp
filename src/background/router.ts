import { aiStatus } from '@/ai/active';
import { askPage, forgetPage } from '@/features/ask-page';
import { crossTabCandidates, missingOrigins, runCrossTab } from '@/features/cross-tab';
import { browserSearch, instantSearch, openResult, openResults } from '@/features/instant-links';
import { finishPreview, previewImage, startPreview } from '@/features/link-preview';
import { askAi } from '@/features/ask-ai';
import { closeLittleWindows, isLittleWindow, moveToMainWindow, openLittle } from '@/features/little';
import { browseAnswer, browseFetch } from '@/features/browse';
import { mediaAction, nowPlaying } from '@/features/media';
import { calendarPeek, gmailPeek, openPeekLink } from '@/features/peeks';
import { applyTitles, proposeTitles, restoreTitles, titleKey } from '@/features/tab-titles';
import { canUndoTidy, tidyTabs, undoTidyTabs } from '@/features/tidy-tabs';
import { AUTO_UPDATED_KEY, checkForUpdate, currentUpdate, reloadIfNewerOnDisk } from '@/features/updates';
import { chromeTabsPort } from '@/features/tidy-tabs/chrome-port';
import { loadSettings, saveSettings } from '@/storage/settings';
import { UserFacingError, serializeError } from '@/shared/errors';
import { requestSchema, type Reply, type Request, type ResponseMap, type UpdateStatus } from '@/shared/messages';
import type { TabSummary } from '@/shared/types';
import { originPattern } from '@/shared/url';

const operations = new Map<string, AbortController>();

/** True while an AI request is in flight; an automatic reload waits for it. */
export const hasRunningOperations = () => operations.size > 0;

export function registerRouter(): void {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only our own pages and content scripts; never web pages or other extensions.
    if (sender.id !== browser.runtime.id) return false;
    const parsed = requestSchema.safeParse(message);
    if (!parsed.success) return false;

    handle(parsed.data, sender)
      .then((data) => sendResponse({ ok: true, data } satisfies Reply<Request['type']>))
      .catch((error: unknown) => {
        if (!(error instanceof UserFacingError)) console.error('[blimp]', parsed.data.type, error);
        sendResponse({ ok: false, error: serializeError(error) } satisfies Reply<Request['type']>);
      });
    return true;
  });
}

async function handle(
  request: Request,
  sender: Browser.runtime.MessageSender,
): Promise<ResponseMap[Request['type']]> {
  switch (request.type) {
    case 'tabs/list':
      return listTabs(await targetWindowId(request.windowId, sender));

    case 'tabs/activate': {
      const tab = await browser.tabs.update(request.tabId, { active: true });
      if (tab?.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
      return null;
    }

    case 'ai/status':
      return aiStatus();

    case 'profiles/list': {
      const settings = await loadSettings();
      return settings.profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        model: profile.model,
        active: profile.id === settings.activeProfileId,
      }));
    }

    case 'profiles/activate': {
      const settings = await loadSettings();
      if (!settings.profiles.some((profile) => profile.id === request.profileId)) {
        throw new UserFacingError('not-configured', 'That AI profile no longer exists.');
      }
      await saveSettings({ ...settings, activeProfileId: request.profileId });
      return aiStatus();
    }

    case 'tidy/run': {
      const windowId = await targetWindowId(request.windowId, sender);
      return withOperation(request.opId, (signal) => tidyTabs(chromeTabsPort, windowId, signal));
    }

    case 'tidy/undo':
      return undoTidyTabs(chromeTabsPort);

    case 'tidy/can-undo':
      return canUndoTidy();

    case 'page/ask': {
      const tabId = targetTabId(request.tabId, sender);
      return withOperation(request.opId, (signal) => askPage(tabId, request.question, signal));
    }

    case 'page/forget':
      await forgetPage(targetTabId(request.tabId, sender));
      return null;

    case 'cross/candidates':
      return crossTabCandidates(await targetWindowId(request.windowId, sender));

    case 'cross/missing-origins':
      return missingOrigins(request.tabIds, request.tabId ?? sender.tab?.id);

    case 'cross/run': {
      const windowId = await targetWindowId(request.windowId, sender);
      return withOperation(request.opId, (signal) =>
        runCrossTab({ windowId, tabIds: request.tabIds, question: request.question, wake: request.wake, signal }),
      );
    }

    case 'permissions/has':
      return browser.permissions.contains({ origins: [request.origin] });

    case 'permissions/open-grant': {
      // Content scripts can't show permission prompts, so a small extension window asks instead.
      const origins = request.origins.filter((origin) => originPattern(origin.replace(/\*$/, '')) === origin);
      if (origins.length === 0) throw new UserFacingError('permission', 'Nothing to grant.');
      await browser.windows.create({
        url: browser.runtime.getURL(`/grant.html?${new URLSearchParams({ origins: origins.join(' ') })}`),
        type: 'popup',
        width: 440,
        height: 420,
      });
      return null;
    }

    case 'preview/start':
      return withOperation(request.opId, (signal) => startPreview(request.url, signal));

    case 'preview/finish':
      return withOperation(request.opId, (signal) => finishPreview(request.page, signal));

    case 'preview/image':
      return withOperation(request.opId, (signal) => previewImage(request.url, signal));

    case 'instant/search':
      return withOperation(request.opId, (signal) => instantSearch(request.query, signal));

    case 'instant/open':
      await openResult(request.url, request.tabId ?? sender.tab?.id);
      return null;

    case 'instant/open-many':
      await openResults(request.urls, request.tabId ?? sender.tab?.id);
      return null;

    case 'instant/web-search':
      await browserSearch(request.query);
      return null;

    case 'update/status': {
      const stored = await browser.storage.local.get(AUTO_UPDATED_KEY);
      return {
        current: browser.runtime.getManifest().version,
        update: await currentUpdate(),
        autoUpdated: stored[AUTO_UPDATED_KEY] as UpdateStatus['autoUpdated'],
      };
    }

    case 'update/check':
      if (await reloadIfNewerOnDisk(hasRunningOperations)) return { current: browser.runtime.getManifest().version, update: null };
      await checkForUpdate({ force: true });
      return { current: browser.runtime.getManifest().version, update: await currentUpdate() };

    case 'update/show':
      await browser.tabs.create({ url: browser.runtime.getURL('/options.html#updates') });
      return null;

    case 'titles/propose': {
      const windowId = await targetWindowId(request.windowId, sender);
      return withOperation(request.opId, (signal) => proposeTitles(windowId, signal));
    }

    case 'titles/apply':
      return applyTitles(request.items);

    case 'titles/restore':
      return restoreTitles(request.tabIds);

    case 'titles/current': {
      const tabId = targetTabId(request.tabId, sender);
      const tab = await browser.tabs.get(tabId);
      const key = tab.url ? titleKey(tab.url) : null;
      const saved = key ? ((await browser.storage.local.get('tabTitles')).tabTitles as Record<string, string> | undefined)?.[key] : undefined;
      return { tabId, title: saved ?? tab.title ?? '', renamed: Boolean(saved) };
    }

    case 'media/list':
      return nowPlaying(request.tabId ?? sender.tab?.id);

    case 'media/action':
      return mediaAction(request.tabId, request.action, sender.tab?.id);

    case 'peek/gmail':
      return gmailPeek();

    case 'peek/calendar':
      return calendarPeek();

    case 'peek/open':
      await openPeekLink(request.url);
      return null;

    case 'ai/ask':
      return withOperation(request.opId, (signal) => askAi(request.messages, signal));

    case 'browse/fetch':
      return withOperation(request.opId, (signal) => browseFetch(request.query, signal));

    case 'browse/answer':
      return withOperation(request.opId, (signal) => browseAnswer(request.query, request.sources, signal));

    case 'little/open':
      await openLittle(request.url);
      return null;

    case 'little/status': {
      const tabId = request.tabId ?? sender.tab?.id;
      const tab = tabId === undefined ? undefined : await browser.tabs.get(tabId).catch(() => undefined);
      return { inLittle: await isLittleWindow(tab?.windowId) };
    }

    case 'little/to-main':
      await moveToMainWindow(targetTabId(request.tabId, sender));
      return null;

    case 'little/close-all':
      return closeLittleWindows();

    case 'op/cancel':
      operations.get(request.opId)?.abort();
      return null;

    case 'shortcut/get':
      return (await browser.commands.getAll()).find((command) => command.name === request.name)?.shortcut ?? '';

    case 'settings/open':
      await browser.runtime.openOptionsPage();
      return null;
  }
}

async function withOperation<T>(opId: string, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  operations.set(opId, controller);
  try {
    return await run(controller.signal);
  } finally {
    operations.delete(opId);
  }
}

/**
 * The palette's window. The popup palette names it explicitly (in its own popup window, the
 * sender's tab would be the palette itself); the overlay uses the tab it runs in.
 */
async function targetWindowId(explicit: number | undefined, sender: Browser.runtime.MessageSender) {
  if (explicit !== undefined) return explicit;
  if (sender.tab?.windowId !== undefined) return sender.tab.windowId;
  const window = await browser.windows.getLastFocused({ windowTypes: ['normal'] });
  if (window.id === undefined) throw new UserFacingError('internal', 'No browser window found.');
  return window.id;
}

function targetTabId(explicit: number | undefined, sender: Browser.runtime.MessageSender): number {
  const tabId = explicit ?? sender.tab?.id;
  if (tabId === undefined) throw new UserFacingError('page-unavailable', 'No page selected.');
  return tabId;
}

async function listTabs(windowId: number): Promise<TabSummary[]> {
  const ownPages = browser.runtime.getURL('/');
  const tabs = await browser.tabs.query({ windowId });
  return tabs
    .filter((tab) => tab.id !== undefined && !tab.url?.startsWith(ownPages))
    .map((tab) => ({
      id: tab.id!,
      windowId: tab.windowId,
      index: tab.index,
      title: tab.title ?? '',
      url: tab.url ?? tab.pendingUrl ?? '',
      favIconUrl: tab.favIconUrl,
      active: tab.active,
      pinned: tab.pinned,
      groupId: tab.groupId,
    }));
}
