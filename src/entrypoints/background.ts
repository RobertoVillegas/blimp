import { openPalette } from '@/background/palette';
import { registerRouter } from '@/background/router';
import { restrictSessionStorage } from '@/storage/secrets';

export default defineBackground(() => {
  void restrictSessionStorage();
  registerRouter();

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
