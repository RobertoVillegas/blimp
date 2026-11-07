import { canInjectInto, isHttpUrl } from "@/shared/url";

export const MAX_TABS = 20;

export const ASLEEP_REASON = "Asleep: open it once to include it";

export interface TabInfo {
  id: number;
  url: string;
  discarded: boolean;
  status?: string;
}

/** Why a tab cannot be read at all, independent of permissions. */
export function blockedReason(tab: TabInfo): string | undefined {
  if (!isHttpUrl(tab.url)) return "Browser or extension page";
  if (!canInjectInto(tab.url)) return "Extensions cannot read this site";
  if (isAsleep(tab)) return ASLEEP_REASON;
  return undefined;
}

export function isAsleep(tab: TabInfo): boolean {
  return tab.discarded || tab.status === "unloaded";
}
