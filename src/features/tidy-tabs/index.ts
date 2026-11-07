import { activeProvider } from "@/ai/active";
import { completeJson } from "@/ai/client";
import { UserFacingError } from "@/shared/errors";
import type { TidyResult, UndoResult } from "@/shared/types";
import { applyPlan, restoreSnapshot, takeSnapshot } from "./apply";
import { eligibleTabs, proposalSchema, validateProposal } from "./plan";
import {
  EXISTING_GROUPS_RULE,
  TIDY_SYSTEM_PROMPT,
  tidyUserPrompt,
} from "./prompt";
import type { OfferedGroup, PortTab, TabsPort, TidyRecord } from "./types";
import { NO_GROUP } from "./types";

const RECORD_KEY = "tidy:last";
let running = false;

export async function tidyTabs(
  port: TabsPort,
  windowId: number,
  signal?: AbortSignal,
): Promise<TidyResult> {
  if (running)
    throw new UserFacingError("nothing-to-do", "Tidy Tabs is already running.");
  running = true;
  try {
    const snapshot = await takeSnapshot(port, windowId);
    const windowTabs = await port.windowTabs(windowId);
    const tabs = eligibleTabs(windowTabs, browser.runtime.getURL("/"));
    const { config, settings } = await activeProvider("tidy");
    const offered = settings.tidyIntoExistingGroups
      ? offerGroups(snapshot.groups, windowTabs)
      : [];
    if (tabs.length === 0 || (tabs.length < 2 && offered.length === 0)) {
      throw new UserFacingError(
        "nothing-to-do",
        "There are fewer than two ungrouped, unpinned tabs to tidy.",
      );
    }

    const proposal = await completeJson(
      config,
      {
        system: offered.length
          ? TIDY_SYSTEM_PROMPT + EXISTING_GROUPS_RULE
          : TIDY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: tidyUserPrompt(tabs, offered) }],
        temperature: settings.temperature,
        maxOutputTokens: Math.max(settings.maxOutputTokens, 800),
        signal,
      },
      proposalSchema,
    );
    const plan = validateProposal(
      proposal,
      tabs.map((tab) => tab.id),
      offered,
    );
    if (plan.length === 0) {
      throw new UserFacingError(
        "nothing-to-do",
        "No related tabs found to group. Nothing was changed.",
      );
    }
    signal?.throwIfAborted();

    const { record, applied } = await applyPlan(port, snapshot, plan);
    if (applied.length)
      await browser.storage.session.set({ [RECORD_KEY]: record });

    const grouped = applied.reduce(
      (sum, group) => sum + group.tabIds.length,
      0,
    );
    return {
      groups: applied.map((group) => ({
        title: group.title,
        color: group.color,
        tabCount: group.tabIds.length,
        existing: group.existingGroupId !== undefined,
      })),
      ungroupedCount: tabs.length - grouped,
      skippedCount:
        plan.reduce((sum, group) => sum + group.tabIds.length, 0) - grouped,
    };
  } finally {
    running = false;
  }
}

/** Existing groups the model may add to, with a few member titles so it knows what each is about. */
function offerGroups(
  groups: { id: number; title: string; color: OfferedGroup["color"] }[],
  tabs: PortTab[],
): OfferedGroup[] {
  return groups
    .map((group, index) => ({
      ref: `G${index + 1}`,
      id: group.id,
      title: group.title,
      color: group.color,
      sampleTitles: tabs
        .filter((tab) => tab.groupId === group.id && tab.groupId !== NO_GROUP)
        .slice(0, 4)
        .map((tab) => tab.title),
    }))
    .filter((group) => group.sampleTitles.length > 0);
}

export async function canUndoTidy(): Promise<boolean> {
  const stored = await browser.storage.session.get(RECORD_KEY);
  return Boolean(stored[RECORD_KEY]);
}

export async function undoTidyTabs(port: TabsPort): Promise<UndoResult> {
  const stored = await browser.storage.session.get(RECORD_KEY);
  const record = stored[RECORD_KEY] as TidyRecord | undefined;
  if (!record)
    throw new UserFacingError(
      "nothing-to-do",
      "There is no Tidy Tabs operation to undo.",
    );
  const result = await restoreSnapshot(port, record);
  await browser.storage.session.remove(RECORD_KEY);
  return result;
}
