import type { GroupColor } from '@/shared/types';

export interface PortTab {
  id: number;
  windowId: number;
  index: number;
  pinned: boolean;
  groupId: number;
  title: string;
  url: string;
}

export interface PortGroup {
  id: number;
  title: string;
  color: GroupColor;
  collapsed: boolean;
}

/** The slice of `tabs`/`tabGroups` Tidy Tabs uses, so it can be tested without a browser. */
export interface TabsPort {
  windowTabs(windowId: number): Promise<PortTab[]>;
  getTab(tabId: number): Promise<PortTab | undefined>;
  windowGroups(windowId: number): Promise<PortGroup[]>;
  group(tabIds: number[], windowId: number): Promise<number>;
  updateGroup(groupId: number, update: { title: string; color: GroupColor }): Promise<void>;
  ungroup(tabIds: number[]): Promise<void>;
  move(tabId: number, index: number): Promise<void>;
}

export interface PlannedGroup {
  title: string;
  color: GroupColor;
  tabIds: number[];
}

export interface Snapshot {
  windowId: number;
  takenAt: number;
  tabs: Pick<PortTab, 'id' | 'index' | 'groupId' | 'pinned'>[];
  groups: PortGroup[];
}

export interface TidyRecord {
  snapshot: Snapshot;
  createdGroupIds: number[];
}

export const NO_GROUP = -1;
