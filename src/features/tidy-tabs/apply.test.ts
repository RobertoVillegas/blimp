import { describe, expect, it } from 'vitest';
import { applyPlan, restoreSnapshot, takeSnapshot } from './apply';
import { FakeTabs } from './fake-tabs';

const ids = (...values: number[]) => values.map((id) => ({ id }));

describe('applyPlan + restoreSnapshot', () => {
  it('creates named native groups and undoes them back to the original order', async () => {
    const tabs = new FakeTabs([{ id: 1, pinned: true }, ...ids(2, 3, 4, 5, 6, 7)]);
    const snapshot = await takeSnapshot(tabs, 1);

    const { record, applied } = await applyPlan(tabs, snapshot, [
      { title: 'Docs', color: 'blue', tabIds: [2, 5] },
      { title: 'News', color: 'red', tabIds: [4, 7] },
    ]);

    expect(applied).toHaveLength(2);
    expect([...tabs.groups.values()].map((group) => [group.title, group.color])).toEqual([
      ['Docs', 'blue'],
      ['News', 'red'],
    ]);
    expect(tabs.order()).not.toEqual([1, 2, 3, 4, 5, 6, 7]);

    const result = await restoreSnapshot(tabs, record);
    expect(tabs.order()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(tabs.groups.size).toBe(0);
    expect(result).toEqual({ restoredCount: 4, conflicts: [] });
  });

  it('leaves existing groups and pinned tabs untouched on apply and undo', async () => {
    const tabs = new FakeTabs([{ id: 1, pinned: true }, { id: 2, groupId: 9 }, { id: 3, groupId: 9 }, ...ids(4, 5, 6)]);
    const before = { ...tabs.groups.get(9)! };
    const snapshot = await takeSnapshot(tabs, 1);
    const { record } = await applyPlan(tabs, snapshot, [{ title: 'Pair', color: 'green', tabIds: [4, 6] }]);
    await restoreSnapshot(tabs, record);

    expect(tabs.order()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(tabs.groups.get(9)).toEqual(before);
    expect(tabs.tabs.filter((tab) => tab.groupId === 9).map((tab) => tab.id)).toEqual([2, 3]);
  });

  it('skips tabs that changed after planning instead of grouping them', async () => {
    const tabs = new FakeTabs(ids(1, 2, 3, 4));
    const snapshot = await takeSnapshot(tabs, 1);
    tabs.close(2);

    const { applied } = await applyPlan(tabs, snapshot, [
      { title: 'A', color: 'blue', tabIds: [1, 2] },
      { title: 'B', color: 'red', tabIds: [3, 4] },
    ]);
    expect(applied.map((group) => group.title)).toEqual(['B']);
  });

  it('rolls back every group if the browser fails midway', async () => {
    const tabs = new FakeTabs(ids(1, 2, 3, 4, 5));
    tabs.failGroupAfter = 1;
    const snapshot = await takeSnapshot(tabs, 1);

    await expect(
      applyPlan(tabs, snapshot, [
        { title: 'A', color: 'blue', tabIds: [1, 3] },
        { title: 'B', color: 'red', tabIds: [2, 5] },
      ]),
    ).rejects.toThrow(/restored/);
    expect(tabs.order()).toEqual([1, 2, 3, 4, 5]);
    expect(tabs.groups.size).toBe(0);
  });

  it('keeps relative order when tabs were opened meanwhile', async () => {
    const tabs = new FakeTabs(ids(1, 2, 3, 4, 5, 6));
    const { record } = await applyPlan(tabs, await takeSnapshot(tabs, 1), [
      { title: 'A', color: 'blue', tabIds: [2, 5] },
      { title: 'B', color: 'red', tabIds: [3, 6] },
    ]);
    tabs.tabs.unshift({ ...tabs.tabs[0]!, id: 99, groupId: -1 });
    tabs.close(1);

    await restoreSnapshot(tabs, record);
    expect(tabs.order()).toEqual([99, 2, 3, 4, 5, 6]);
  });

  it('reports tabs closed or regrouped since tidying', async () => {
    const tabs = new FakeTabs(ids(1, 2, 3, 4, 5, 6));
    const { record } = await applyPlan(tabs, await takeSnapshot(tabs, 1), [
      { title: 'A', color: 'blue', tabIds: [1, 4] },
      { title: 'B', color: 'red', tabIds: [2, 5] },
    ]);
    tabs.close(4);
    tabs.pin(6);

    const result = await restoreSnapshot(tabs, record);
    expect(result.restoredCount).toBe(3);
    expect(result.conflicts).toEqual([
      '1 tab was closed since tidying.',
      '1 tab was pinned or regrouped since tidying and left as is.',
    ]);
    expect(tabs.order()).toEqual([6, 1, 2, 3, 5]);
    expect(tabs.groups.size).toBe(0);
  });
});

describe('adding to existing groups', () => {
  it('adds tabs to the user group without renaming it, and Undo takes them back out', async () => {
    const tabs = new FakeTabs([{ id: 1, groupId: 9 }, { id: 2, groupId: 9 }, ...ids(3, 4, 5)]);
    tabs.groups.get(9)!.title = 'PHP';
    const before = structuredClone(tabs.groups.get(9));
    const snapshot = await takeSnapshot(tabs, 1);

    const { record } = await applyPlan(tabs, snapshot, [{ title: 'PHP', color: 'grey', tabIds: [4], existingGroupId: 9 }]);
    expect(tabs.order()).toEqual([1, 2, 4, 3, 5]);
    expect(tabs.tabs.find((tab) => tab.id === 4)!.groupId).toBe(9);
    expect(tabs.groups.get(9)).toEqual(before);

    const result = await restoreSnapshot(tabs, record);
    expect(result).toEqual({ restoredCount: 1, conflicts: [] });
    expect(tabs.order()).toEqual([1, 2, 3, 4, 5]);
    expect(tabs.tabs.filter((tab) => tab.groupId === 9).map((tab) => tab.id)).toEqual([1, 2]);
    expect(tabs.groups.get(9)).toEqual(before);
  });

  it('skips a group the user closed meanwhile', async () => {
    const tabs = new FakeTabs([{ id: 1, groupId: 9 }, ...ids(2, 3)]);
    const snapshot = await takeSnapshot(tabs, 1);
    tabs.close(1);
    const { applied } = await applyPlan(tabs, snapshot, [{ title: 'Gone', color: 'grey', tabIds: [2], existingGroupId: 9 }]);
    expect(applied).toEqual([]);
  });
});
