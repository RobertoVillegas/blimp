import { z } from 'zod';
import { GROUP_COLORS, type GroupColor } from '@/shared/types';
import { UserFacingError } from '@/shared/errors';
import type { PlannedGroup, PortTab } from './types';
import { NO_GROUP } from './types';

export const MAX_GROUP_TITLE = 28;
const MAX_GROUPS = 12;

/** Shape the model is asked to return. Tabs are referenced by the 1-based numbers in the prompt. */
export const proposalSchema = z.object({
  groups: z
    .array(
      z.object({
        name: z.string(),
        color: z.string().optional(),
        tabs: z.array(z.number().int()),
      }),
    )
    .max(MAX_GROUPS),
});

export type Proposal = z.infer<typeof proposalSchema>;

/** Default scope: ungrouped, unpinned tabs in the window. Existing groups and pinned tabs are never touched. */
export function eligibleTabs(tabs: PortTab[], excludeUrlPrefix?: string): PortTab[] {
  return tabs.filter(
    (tab) =>
      !tab.pinned &&
      tab.groupId === NO_GROUP &&
      !(excludeUrlPrefix && tab.url.startsWith(excludeUrlPrefix)),
  );
}

/**
 * Turn a model proposal into a plan, or throw without side effects.
 * Any reference to a tab that wasn't offered, or a tab placed twice, rejects the whole proposal.
 */
export function validateProposal(proposal: Proposal, refs: readonly number[]): PlannedGroup[] {
  const seen = new Set<number>();
  const usedColors = new Set<GroupColor>();
  const groups: PlannedGroup[] = [];

  for (const group of proposal.groups) {
    const title = cleanTitle(group.name);
    if (!title) throw invalid();

    const tabIds: number[] = [];
    for (const ref of group.tabs) {
      const tabId = refs[ref - 1];
      if (tabId === undefined || seen.has(ref)) throw invalid();
      seen.add(ref);
      tabIds.push(tabId);
    }
    if (tabIds.length < 2) continue;

    const color = pickColor(group.color, usedColors);
    usedColors.add(color);
    groups.push({ title, color, tabIds });
  }
  return groups;
}

export function cleanTitle(name: string): string {
  const text = name.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_GROUP_TITLE) return text;
  const cut = text.slice(0, MAX_GROUP_TITLE + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 10 ? cut.slice(0, lastSpace) : text.slice(0, MAX_GROUP_TITLE)).trim();
}

function pickColor(requested: string | undefined, used: Set<GroupColor>): GroupColor {
  const normalized = requested?.toLowerCase().trim();
  if (normalized === 'gray') return pickColor('grey', used);
  if (GROUP_COLORS.includes(normalized as GroupColor)) return normalized as GroupColor;
  return GROUP_COLORS.find((color) => color !== 'grey' && !used.has(color)) ?? 'grey';
}

function invalid() {
  return new UserFacingError(
    'invalid-output',
    'The model proposed groups that do not match your tabs. Nothing was changed; try again.',
  );
}
