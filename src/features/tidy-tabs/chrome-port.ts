import type { GroupColor } from "@/shared/types";
import type { PortGroup, PortTab, TabsPort } from "./types";

function toPortTab(tab: Browser.tabs.Tab): PortTab | undefined {
  if (tab.id === undefined) return undefined;
  return {
    id: tab.id,
    windowId: tab.windowId,
    index: tab.index,
    pinned: tab.pinned,
    groupId: tab.groupId,
    title: tab.title ?? "",
    url: tab.url ?? tab.pendingUrl ?? "",
  };
}

export const chromeTabsPort: TabsPort = {
  async windowTabs(windowId) {
    const tabs = await browser.tabs.query({ windowId });
    return tabs
      .map(toPortTab)
      .filter((tab): tab is PortTab => tab !== undefined);
  },
  async getTab(tabId) {
    try {
      return toPortTab(await browser.tabs.get(tabId));
    } catch {
      return undefined;
    }
  },
  async windowGroups(windowId) {
    const groups = await browser.tabGroups.query({ windowId });
    return groups.map((group): PortGroup => ({
      id: group.id,
      title: group.title ?? "",
      color: group.color as GroupColor,
      collapsed: group.collapsed,
    }));
  },
  async group(tabIds, windowId) {
    return browser.tabs.group({
      tabIds: tabIds as [number, ...number[]],
      createProperties: { windowId },
    });
  },
  async updateGroup(groupId, update) {
    await browser.tabGroups.update(groupId, update);
  },
  async addToGroup(tabIds, groupId) {
    await browser.tabs.group({
      tabIds: tabIds as [number, ...number[]],
      groupId,
    });
  },
  async ungroup(tabIds) {
    await browser.tabs.ungroup(tabIds as [number, ...number[]]);
  },
  async move(tabId, index) {
    await browser.tabs.move(tabId, { index });
  },
};
