import { openPalette } from '@/background/palette';
import { hasRunningOperations, registerRouter } from '@/background/router';
import { syncLinkPreviewScript } from '@/features/link-preview';
import { syncRegisteredScript } from '@/shared/registered-scripts';
import { registerTitleKeeper } from '@/features/tab-titles';
import { registerTidyDownloads } from '@/features/tidy-downloads';
import { currentUpdate, registerUpdateChecks, showBadge } from '@/features/updates';
import { loadSettings } from '@/storage/settings';
import { restrictSessionStorage } from '@/storage/secrets';

export default defineBackground(() => {
  void restrictSessionStorage();
  registerRouter();
  registerUpdateChecks(hasRunningOperations);
  registerTitleKeeper();
  void currentUpdate().then(showBadge);
  // Must be added synchronously at startup so Chrome routes downloads to it after a restart.
  registerTidyDownloads();
  browser.permissions.onAdded.addListener(({ permissions }) => {
    if (permissions?.includes('downloads')) registerTidyDownloads();
  });

  // Settings are the source of truth for the hover script; Settings and tests just write storage.
  const syncPreviews = async () => {
    const settings = await loadSettings();
    await syncLinkPreviewScript(settings.linkPreviews);
    await syncRegisteredScript('auto-float', 'content-scripts/auto-float.js', settings.autoFloat);
  };
  void syncPreviews();
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) void syncPreviews();
  });

  browser.action.onClicked.addListener((tab) => void openPalette(tab));

  // The side panel opens only from a direct user action, so it's wired to the shortcut and the
  // toolbar icon's menu, never to a message from a page.
  browser.contextMenus.removeAll(() => {
    browser.contextMenus.create({ id: 'open-sidebar', title: 'Open sidebar', contexts: ['action'] });
  });
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'open-sidebar' && tab?.windowId !== undefined) void openSidebar(tab.windowId);
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'open-sidebar') {
      // Call before any await: the user action only counts for the first synchronous step.
      if (tab?.windowId !== undefined) void openSidebar(tab.windowId);
      return;
    }
    const target = tab ?? (await activeTab());
    if (command === 'open-palette' || command === 'open-palette-fallback') await openPalette(target);
    // The Tidy Tabs shortcut is an explicit request; it runs inside the palette so progress and Undo are visible.
    else if (command === 'tidy-tabs') await openPalette(target, 'tidy');
  });

  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void browser.runtime.openOptionsPage();
  });
});

function openSidebar(windowId: number) {
  return browser.sidePanel?.open({ windowId }).catch(() => undefined);
}

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}
