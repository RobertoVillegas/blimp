import { openPalette } from '@/background/palette';
import { hasRunningOperations, registerRouter } from '@/background/router';
import { syncLinkPreviewScript } from '@/features/link-preview';
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
  const syncPreviews = async () => syncLinkPreviewScript((await loadSettings()).linkPreviews);
  void syncPreviews();
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) void syncPreviews();
  });

  browser.action.onClicked.addListener((tab) => void openPalette(tab));

  browser.commands.onCommand.addListener(async (command, tab) => {
    const target = tab ?? (await activeTab());
    if (command === 'open-palette' || command === 'open-palette-fallback') await openPalette(target);
    // The Tidy Tabs shortcut is an explicit request; it runs inside the palette so progress and Undo are visible.
    else if (command === 'tidy-tabs') await openPalette(target, 'tidy');
  });

  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void browser.runtime.openOptionsPage();
  });
});

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}
