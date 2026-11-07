export const ARCHIVE_AFTER = { off: 0, '12h': 12 * 3_600_000, '24h': 24 * 3_600_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 } as const;
export type ArchiveAfter = keyof typeof ARCHIVE_AFTER;

export interface ArchiveCandidate {
  id?: number;
  url?: string;
  pinned: boolean;
  active: boolean;
  audible?: boolean;
  groupId: number;
  lastAccessed?: number;
}

/**
 * Tabs to archive: web pages nobody has looked at for `maxAgeMs`. Never pinned, active, playing
 * or grouped tabs (groups are how Helium organizes what you keep), and never without a known
 * last-used time.
 */
export function staleTabs<T extends ArchiveCandidate>(tabs: T[], now: number, maxAgeMs: number): T[] {
  if (maxAgeMs <= 0) return [];
  return tabs.filter(
    (tab) =>
      tab.id !== undefined &&
      !tab.pinned &&
      !tab.active &&
      !tab.audible &&
      tab.groupId === -1 &&
      /^https?:\/\//.test(tab.url ?? '') &&
      typeof tab.lastAccessed === 'number' &&
      now - tab.lastAccessed >= maxAgeMs,
  );
}
