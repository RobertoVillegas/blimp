import { UserFacingError } from '@/shared/errors';
import type { UndoResult } from '@/shared/types';
import type { PlannedGroup, Snapshot, TabsPort, TidyRecord } from './types';
import { NO_GROUP } from './types';

export async function takeSnapshot(port: TabsPort, windowId: number): Promise<Snapshot> {
  const [tabs, groups] = await Promise.all([port.windowTabs(windowId), port.windowGroups(windowId)]);
  return {
    windowId,
    takenAt: Date.now(),
    tabs: tabs.map(({ id, index, groupId, pinned }) => ({ id, index, groupId, pinned })),
    groups,
  };
}

/**
 * Create native groups for a validated plan. Tabs that changed since planning (closed, pinned,
 * grouped, moved window) are dropped. If the browser fails midway, everything is rolled back.
 */
export async function applyPlan(
  port: TabsPort,
  snapshot: Snapshot,
  plan: PlannedGroup[],
): Promise<{ record: TidyRecord; applied: PlannedGroup[] }> {
  const current = new Map((await port.windowTabs(snapshot.windowId)).map((tab) => [tab.id, tab]));
  const stillEligible = (id: number) => {
    const tab = current.get(id);
    return tab !== undefined && !tab.pinned && tab.groupId === NO_GROUP;
  };

  const groupStillThere = (groupId: number) => [...current.values()].some((tab) => tab.groupId === groupId);

  const applied: PlannedGroup[] = [];
  const createdGroupIds: number[] = [];
  const addedToExisting: { groupId: number; tabIds: number[] }[] = [];
  try {
    for (const group of plan) {
      const tabIds = group.tabIds.filter(stillEligible);
      if (group.existingGroupId !== undefined) {
        // The user's own group: add tabs, never rename or recolor it.
        if (!tabIds.length || !groupStillThere(group.existingGroupId)) continue;
        addedToExisting.push({ groupId: group.existingGroupId, tabIds });
        await port.addToGroup(tabIds, group.existingGroupId);
        applied.push({ ...group, tabIds });
        continue;
      }
      if (tabIds.length < 2) continue;
      const groupId = await port.group(tabIds, snapshot.windowId);
      createdGroupIds.push(groupId);
      await port.updateGroup(groupId, { title: group.title, color: group.color });
      applied.push({ ...group, tabIds });
    }
  } catch {
    await restoreSnapshot(port, { snapshot, createdGroupIds, addedToExisting });
    throw new UserFacingError('internal', 'The browser refused to create a tab group. Your tabs were restored.');
  }
  return { record: { snapshot, createdGroupIds, addedToExisting }, applied };
}

/** Best-effort undo: ungroup what Tidy Tabs created and put those tabs back in their old positions. */
export async function restoreSnapshot(port: TabsPort, record: TidyRecord): Promise<UndoResult> {
  const { snapshot, createdGroupIds } = record;
  const created = new Set(createdGroupIds);
  // Tab → the existing group Tidy Tabs put it in. It only counts while it's still there.
  const addedTo = new Map((record.addedToExisting ?? []).flatMap(({ groupId, tabIds }) => tabIds.map((id) => [id, groupId] as const)));
  const ours = (tabId: number, groupId: number) => created.has(groupId) || addedTo.get(tabId) === groupId;
  const conflicts: string[] = [];

  const current = new Map((await port.windowTabs(snapshot.windowId)).map((tab) => [tab.id, tab]));
  const tidied = snapshot.tabs.filter((tab) => tab.groupId === NO_GROUP && !tab.pinned);

  let closed = 0;
  let elsewhere = 0;
  let regroupedByUser = 0;
  const toRestore: typeof tidied = [];
  for (const tab of tidied) {
    const now = current.get(tab.id);
    if (!now) {
      if (await port.getTab(tab.id)) elsewhere++;
      else closed++;
      continue;
    }
    if (now.pinned || (now.groupId !== NO_GROUP && !ours(tab.id, now.groupId))) {
      regroupedByUser++;
      continue;
    }
    // Tabs Tidy Tabs left alone only shifted; moving them back is unnecessary.
    if (now.groupId !== NO_GROUP) toRestore.push(tab);
  }

  const toUngroup = [...current.values()].filter((tab) => tab.groupId !== NO_GROUP && ours(tab.id, tab.groupId)).map((tab) => tab.id);
  if (toUngroup.length) await port.ungroup(toUngroup);

  await restoreOrder(port, snapshot, new Set(toRestore.map((tab) => tab.id)));

  if (closed) conflicts.push(`${plural(closed, 'tab was', 'tabs were')} closed since tidying.`);
  if (elsewhere) conflicts.push(`${plural(elsewhere, 'tab was', 'tabs were')} moved to another window and left there.`);
  if (regroupedByUser) {
    conflicts.push(`${plural(regroupedByUser, 'tab was', 'tabs were')} pinned or regrouped since tidying and left as is.`);
  }
  return { restoredCount: toRestore.length, conflicts };
}

/**
 * Put each restored tab right after the tab that preceded it in the snapshot (skipping tabs that
 * are gone), or before the next untouched one, so order survives tabs being opened or closed.
 */
async function restoreOrder(port: TabsPort, snapshot: Snapshot, restoring: Set<number>): Promise<void> {
  const now = await port.windowTabs(snapshot.windowId);
  const present = new Set(now.map((tab) => tab.id));
  const desired = now.filter((tab) => !restoring.has(tab.id)).map((tab) => tab.id);
  const firstUnpinned = now.filter((tab) => tab.pinned && !restoring.has(tab.id)).length;
  const original = [...snapshot.tabs].sort((a, b) => a.index - b.index).filter((tab) => present.has(tab.id));

  original.forEach((tab, position) => {
    if (!restoring.has(tab.id)) return;
    const previous = original[position - 1];
    let at: number;
    if (previous) {
      at = desired.indexOf(previous.id) + 1;
    } else {
      const next = original.slice(position + 1).find((later) => !restoring.has(later.id));
      at = next ? desired.indexOf(next.id) : firstUnpinned;
    }
    desired.splice(Math.max(at, firstUnpinned), 0, tab.id);
  });

  // Place each tab relative to its (already settled) left neighbor rather than by absolute index.
  for (const [position, tabId] of desired.entries()) {
    if (!restoring.has(tabId)) continue;
    const self = (await port.getTab(tabId))?.index;
    if (self === undefined) continue;
    const leftId = desired[position - 1];
    const left = leftId === undefined ? undefined : (await port.getTab(leftId))?.index;
    const target = left === undefined ? 0 : self > left ? left + 1 : left;
    if (self !== target) await port.move(tabId, target);
  }

  // Landing next to an existing group can pull a tab into it; undo that.
  const after = await port.windowTabs(snapshot.windowId);
  const captured = after.filter((tab) => restoring.has(tab.id) && tab.groupId !== NO_GROUP);
  if (captured.length) await port.ungroup(captured.map((tab) => tab.id));
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
