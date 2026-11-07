import { aiStatus } from '@/ai/active';
import { askPage, forgetPage } from '@/features/ask-page';
import { canUndoTidy, tidyTabs, undoTidyTabs } from '@/features/tidy-tabs';
import { chromeTabsPort } from '@/features/tidy-tabs/chrome-port';
import { UserFacingError, serializeError } from '@/shared/errors';
import { requestSchema, type Reply, type Request, type ResponseMap } from '@/shared/messages';
import type { TabSummary } from '@/shared/types';

const operations = new Map<string, AbortController>();

export function registerRouter(): void {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only our own pages and content scripts; never web pages or other extensions.
    if (sender.id !== browser.runtime.id) return false;
    const parsed = requestSchema.safeParse(message);
    if (!parsed.success) return false;

    handle(parsed.data, sender)
      .then((data) => sendResponse({ ok: true, data } satisfies Reply<Request['type']>))
      .catch((error: unknown) => {
        if (!(error instanceof UserFacingError)) console.error('[helium-max]', parsed.data.type, error);
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

    case 'op/cancel':
      operations.get(request.opId)?.abort();
      return null;

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

/** The palette's window: the sender's tab for the overlay, an explicit id for the popup. */
async function targetWindowId(explicit: number | undefined, sender: Browser.runtime.MessageSender) {
  if (sender.tab?.windowId !== undefined) return sender.tab.windowId;
  if (explicit !== undefined) return explicit;
  const window = await browser.windows.getLastFocused({ windowTypes: ['normal'] });
  if (window.id === undefined) throw new UserFacingError('internal', 'No browser window found.');
  return window.id;
}

function targetTabId(explicit: number | undefined, sender: Browser.runtime.MessageSender): number {
  const tabId = sender.tab?.id ?? explicit;
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
