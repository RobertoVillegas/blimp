import type { GroupColor } from '@/shared/types';
import type { PortGroup, PortTab, TabsPort } from './types';
import { NO_GROUP } from './types';

/**
 * In-memory model of one window's tab strip that follows Chromium's rules closely enough for
 * Tidy Tabs: grouped tabs are contiguous, grouping moves tabs next to the first one, and a
 * group disappears when its last tab leaves.
 */
export class FakeTabs implements TabsPort {
  tabs: PortTab[] = [];
  groups = new Map<number, PortGroup>();
  failGroupAfter = Infinity;
  private nextGroupId = 100;

  constructor(spec: { id: number; pinned?: boolean; groupId?: number }[], readonly windowId = 1) {
    this.tabs = spec.map((tab, index) => ({
      id: tab.id,
      windowId,
      index,
      pinned: tab.pinned ?? false,
      groupId: tab.groupId ?? NO_GROUP,
      title: `Tab ${tab.id}`,
      url: `https://example.com/${tab.id}`,
    }));
    for (const tab of this.tabs) {
      if (tab.groupId !== NO_GROUP && !this.groups.has(tab.groupId)) {
        this.groups.set(tab.groupId, { id: tab.groupId, title: `Group ${tab.groupId}`, color: 'grey', collapsed: false });
      }
    }
  }

  order() {
    return this.tabs.map((tab) => tab.id);
  }

  close(tabId: number) {
    this.tabs = this.tabs.filter((tab) => tab.id !== tabId);
    this.reindex();
  }

  /** Pinning ungroups the tab and moves it to the end of the pinned section, like Chromium. */
  pin(tabId: number) {
    const tab = this.tabs.find((candidate) => candidate.id === tabId)!;
    this.tabs = this.tabs.filter((candidate) => candidate !== tab);
    tab.pinned = true;
    tab.groupId = NO_GROUP;
    this.tabs.splice(this.tabs.filter((candidate) => candidate.pinned).length, 0, tab);
    this.reindex();
  }

  async windowTabs() {
    return this.tabs.map((tab) => ({ ...tab }));
  }

  async getTab(tabId: number) {
    const tab = this.tabs.find((candidate) => candidate.id === tabId);
    return tab && { ...tab };
  }

  async windowGroups() {
    return [...this.groups.values()].map((group) => ({ ...group }));
  }

  async group(tabIds: number[]) {
    if (this.groups.size >= this.failGroupAfter) throw new Error('group failed');
    const groupId = this.nextGroupId++;
    const moving = this.tabs.filter((tab) => tabIds.includes(tab.id));
    const anchor = this.tabs.findIndex((tab) => tabIds.includes(tab.id));
    const rest = this.tabs.filter((tab) => !tabIds.includes(tab.id));
    const insertAt = rest.filter((tab, i) => i < anchor).length;
    for (const tab of moving) tab.groupId = groupId;
    rest.splice(insertAt, 0, ...moving);
    this.tabs = rest;
    this.groups.set(groupId, { id: groupId, title: '', color: 'grey', collapsed: false });
    this.reindex();
    return groupId;
  }

  async updateGroup(groupId: number, update: { title: string; color: GroupColor }) {
    Object.assign(this.groups.get(groupId)!, update);
  }

  async ungroup(tabIds: number[]) {
    for (const tab of this.tabs) if (tabIds.includes(tab.id)) tab.groupId = NO_GROUP;
    this.pruneGroups();
  }

  async move(tabId: number, index: number) {
    const from = this.tabs.findIndex((tab) => tab.id === tabId);
    const [tab] = this.tabs.splice(from, 1);
    const target = Math.min(index, this.tabs.length);
    this.tabs.splice(target, 0, tab!);
    // Landing between two tabs of the same group joins that group.
    const left = this.tabs[target - 1];
    const right = this.tabs[target + 1];
    if (left && right && left.groupId !== NO_GROUP && left.groupId === right.groupId) tab!.groupId = left.groupId;
    this.reindex();
  }

  private reindex() {
    this.tabs.forEach((tab, index) => (tab.index = index));
    this.pruneGroups();
  }

  private pruneGroups() {
    for (const id of this.groups.keys()) {
      if (!this.tabs.some((tab) => tab.groupId === id)) this.groups.delete(id);
    }
  }
}
