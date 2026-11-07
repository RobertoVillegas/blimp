import { activeProvider } from '@/ai/active';
import { completeJson } from '@/ai/client';
import { UserFacingError } from '@/shared/errors';
import type { TidyResult, UndoResult } from '@/shared/types';
import { applyPlan, restoreSnapshot, takeSnapshot } from './apply';
import { eligibleTabs, proposalSchema, validateProposal } from './plan';
import { TIDY_SYSTEM_PROMPT, tidyUserPrompt } from './prompt';
import type { TabsPort, TidyRecord } from './types';

const RECORD_KEY = 'tidy:last';
let running = false;

export async function tidyTabs(port: TabsPort, windowId: number, signal?: AbortSignal): Promise<TidyResult> {
  if (running) throw new UserFacingError('nothing-to-do', 'Tidy Tabs is already running.');
  running = true;
  try {
    const snapshot = await takeSnapshot(port, windowId);
    const tabs = eligibleTabs(await port.windowTabs(windowId), browser.runtime.getURL('/'));
    if (tabs.length < 2) {
      throw new UserFacingError('nothing-to-do', 'There are fewer than two ungrouped, unpinned tabs to tidy.');
    }

    const { config, settings } = await activeProvider();
    const proposal = await completeJson(
      config,
      {
        system: TIDY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: tidyUserPrompt(tabs) }],
        temperature: settings.temperature,
        maxOutputTokens: Math.max(settings.maxOutputTokens, 800),
        signal,
      },
      proposalSchema,
    );
    const plan = validateProposal(
      proposal,
      tabs.map((tab) => tab.id),
    );
    if (plan.length === 0) {
      throw new UserFacingError('nothing-to-do', 'No related tabs found to group. Nothing was changed.');
    }
    signal?.throwIfAborted();

    const { record, applied } = await applyPlan(port, snapshot, plan);
    if (applied.length) await browser.storage.session.set({ [RECORD_KEY]: record });

    const grouped = applied.reduce((sum, group) => sum + group.tabIds.length, 0);
    return {
      groups: applied.map((group) => ({ title: group.title, color: group.color, tabCount: group.tabIds.length })),
      ungroupedCount: tabs.length - grouped,
      skippedCount: plan.reduce((sum, group) => sum + group.tabIds.length, 0) - grouped,
    };
  } finally {
    running = false;
  }
}

export async function canUndoTidy(): Promise<boolean> {
  const stored = await browser.storage.session.get(RECORD_KEY);
  return Boolean(stored[RECORD_KEY]);
}

export async function undoTidyTabs(port: TabsPort): Promise<UndoResult> {
  const stored = await browser.storage.session.get(RECORD_KEY);
  const record = stored[RECORD_KEY] as TidyRecord | undefined;
  if (!record) throw new UserFacingError('nothing-to-do', 'There is no Tidy Tabs operation to undo.');
  const result = await restoreSnapshot(port, record);
  await browser.storage.session.remove(RECORD_KEY);
  return result;
}
