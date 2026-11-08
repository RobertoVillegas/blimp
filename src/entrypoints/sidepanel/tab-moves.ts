/** Where a dragged tab lands in the sidebar: Favorites (pinned), a folder (tab group) or Today. */
export type DropTarget = { section: 'favorites' } | { section: 'folder'; groupId: number } | { section: 'today' };

const NO_GROUP = -1;

/** Moves a tab into a section, before `beforeTabId` when given, otherwise at the section's end. */
export async function moveTab(tabId: number, target: DropTarget, beforeTabId?: number): Promise<void> {
  if (tabId === beforeTabId) return;
  let tab = await browser.tabs.get(tabId);
  const wantPinned = target.section === 'favorites';
  if (tab.pinned !== wantPinned) tab = (await browser.tabs.update(tabId, { pinned: wantPinned }))!;
  if (target.section === 'folder' && tab.groupId !== target.groupId) await browser.tabs.group({ groupId: target.groupId, tabIds: tabId });
  if (target.section === 'today' && tab.groupId !== NO_GROUP) await browser.tabs.ungroup(tabId);

  tab = await browser.tabs.get(tabId);
  if (beforeTabId === undefined) {
    if (target.section === 'today') await browser.tabs.move(tabId, { index: -1 });
    return;
  }
  const before = await browser.tabs.get(beforeTabId);
  // tabs.move takes the tab's final index, which is one less when it moves rightwards.
  const index = tab.index < before.index ? before.index - 1 : before.index;
  if (index !== tab.index) await browser.tabs.move(tabId, { index });
  // Moving can carry a tab out of (or into) a group; put it back where the user dropped it.
  if (target.section === 'folder' && (await browser.tabs.get(tabId)).groupId !== target.groupId) {
    await browser.tabs.group({ groupId: target.groupId, tabIds: tabId });
  }
  if (target.section === 'today' && (await browser.tabs.get(tabId)).groupId !== NO_GROUP) await browser.tabs.ungroup(tabId);
}
