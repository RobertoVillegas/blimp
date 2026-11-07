import { describe, expect, it } from 'vitest';
import { cleanTitle, eligibleTabs, validateProposal } from './plan';
import type { PortTab } from './types';

const tab = (id: number, extra: Partial<PortTab> = {}): PortTab => ({
  id,
  windowId: 1,
  index: id,
  pinned: false,
  groupId: -1,
  title: `Tab ${id}`,
  url: `https://example.com/${id}`,
  ...extra,
});

describe('eligibleTabs', () => {
  it('keeps only ungrouped, unpinned tabs and skips our own pages', () => {
    const tabs = [
      tab(1),
      tab(2, { pinned: true }),
      tab(3, { groupId: 7 }),
      tab(4, { url: 'chrome-extension://abc/palette.html' }),
      tab(5),
    ];
    expect(eligibleTabs(tabs, 'chrome-extension://abc/').map((t) => t.id)).toEqual([1, 5]);
  });
});

describe('validateProposal', () => {
  const refs = [101, 102, 103, 104, 105];

  it('maps prompt numbers to tab ids', () => {
    const plan = validateProposal(
      { groups: [{ name: 'Docs', color: 'blue', tabs: [1, 3] }, { name: 'News', color: 'red', tabs: [2, 4] }] },
      refs,
    );
    expect(plan).toEqual([
      { title: 'Docs', color: 'blue', tabIds: [101, 103] },
      { title: 'News', color: 'red', tabIds: [102, 104] },
    ]);
  });

  it('rejects the whole plan when a tab number was never offered', () => {
    expect(() => validateProposal({ groups: [{ name: 'A', tabs: [1, 2] }, { name: 'B', tabs: [3, 9] }] }, refs)).toThrow(
      /Nothing was changed/,
    );
  });

  it('rejects a tab assigned twice', () => {
    expect(() => validateProposal({ groups: [{ name: 'A', tabs: [1, 2] }, { name: 'B', tabs: [2, 3] }] }, refs)).toThrow();
    expect(() => validateProposal({ groups: [{ name: 'A', tabs: [1, 1] }] }, refs)).toThrow();
  });

  it('rejects an empty group name', () => {
    expect(() => validateProposal({ groups: [{ name: ' ​ ', tabs: [1, 2] }] }, refs)).toThrow();
  });

  it('drops single-tab groups instead of forcing coverage', () => {
    const plan = validateProposal({ groups: [{ name: 'Solo', tabs: [5] }, { name: 'Pair', tabs: [1, 2] }] }, refs);
    expect(plan.map((group) => group.title)).toEqual(['Pair']);
  });

  it('replaces unsupported colors with an unused supported one', () => {
    const plan = validateProposal(
      { groups: [{ name: 'A', color: 'blue', tabs: [1, 2] }, { name: 'B', color: 'magenta', tabs: [3, 4] }] },
      refs,
    );
    expect(plan[1]!.color).not.toBe('blue');
    expect(plan[1]!.color).toMatch(/^(grey|red|yellow|green|pink|purple|cyan|orange)$/);
    expect(validateProposal({ groups: [{ name: 'A', color: 'Gray', tabs: [1, 2] }] }, refs)[0]!.color).toBe('grey');
  });
});

describe('cleanTitle', () => {
  it('limits titles to 28 characters at a word boundary', () => {
    const title = cleanTitle('Machine learning research papers and notes');
    expect(title.length).toBeLessThanOrEqual(28);
    expect(title).toBe('Machine learning research');
  });

  it('strips control and format characters', () => {
    expect(cleanTitle('Re‮search\n  Notes')).toBe('Research Notes');
  });
});

describe('validateProposal with existing groups', () => {
  const refs = [101, 102, 103];
  const offered = [{ ref: 'G1', id: 7, title: 'PHP', color: 'blue' as const, sampleTitles: ['php.net'] }];

  it('adds even a single tab to an offered group, keeping its name and color', () => {
    const plan = validateProposal(
      { groups: [{ existing: 'G1', tabs: [2] }, { name: 'Trip', color: 'blue', tabs: [1, 3] }] },
      refs,
      offered,
    );
    expect(plan).toEqual([
      { title: 'PHP', color: 'blue', tabIds: [102], existingGroupId: 7 },
      // New groups avoid the colors of existing ones.
      { title: 'Trip', color: 'red', tabIds: [101, 103] },
    ]);
  });

  it('merges repeated entries for the same existing group', () => {
    const plan = validateProposal({ groups: [{ existing: 'G1', tabs: [1] }, { existing: 'G1', tabs: [3] }] }, refs, offered);
    expect(plan).toEqual([{ title: 'PHP', color: 'blue', tabIds: [101, 103], existingGroupId: 7 }]);
  });

  it('rejects a group that was not offered', () => {
    expect(() => validateProposal({ groups: [{ existing: 'G2', tabs: [1] }] }, refs, offered)).toThrow(/Nothing was changed/);
    expect(() => validateProposal({ groups: [{ existing: 'G1', tabs: [1] }] }, refs, [])).toThrow();
  });
});
