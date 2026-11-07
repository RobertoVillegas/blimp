import { canInjectInto } from "@/shared/url";
import type { PaletteIntent, PaletteSignal } from "@/shared/messages";

const SCRIPT = "/content-scripts/overlay.js";

/**
 * Show the palette as an in-page overlay when the page allows injection (needs the activeTab
 * grant from a shortcut or toolbar click); otherwise open the popup version.
 */
export async function openPalette(
  tab: Browser.tabs.Tab | undefined,
  intent?: PaletteIntent,
): Promise<void> {
  if (tab?.id !== undefined && canInjectInto(tab.url)) {
    try {
      await showOverlay(tab.id, intent);
      return;
    } catch {
      // Restricted page or no grant: fall through to the popup.
    }
  }
  await openPopupPalette(tab, intent);
}

async function showOverlay(
  tabId: number,
  intent?: PaletteIntent,
): Promise<void> {
  const signal: PaletteSignal = { type: "palette/toggle", intent };
  try {
    await browser.tabs.sendMessage(tabId, signal);
  } catch {
    // Not injected yet in this document.
    await browser.scripting.executeScript({
      target: { tabId },
      files: [SCRIPT],
    });
    await browser.tabs.sendMessage(tabId, signal);
  }
}

async function openPopupPalette(
  tab: Browser.tabs.Tab | undefined,
  intent?: PaletteIntent,
): Promise<void> {
  const query = new URLSearchParams();
  if (intent) query.set("intent", intent);
  if (tab?.windowId !== undefined) query.set("windowId", String(tab.windowId));
  if (tab?.id !== undefined) query.set("tabId", String(tab.id));
  const page = `/palette.html?${query}` as const;
  try {
    await browser.action.setPopup({ popup: page });
    await browser.action.openPopup();
  } catch {
    const current =
      tab?.windowId !== undefined
        ? await browser.windows.get(tab.windowId)
        : undefined;
    const width = 640;
    await browser.windows.create({
      url: browser.runtime.getURL(page),
      type: "popup",
      width,
      height: 520,
      left:
        current?.left !== undefined && current.width
          ? current.left + Math.round((current.width - width) / 2)
          : undefined,
      top: current?.top !== undefined ? current.top + 80 : undefined,
    });
  } finally {
    // Keep toolbar clicks routed through action.onClicked so the overlay stays the default.
    await browser.action.setPopup({ popup: "" });
  }
}
