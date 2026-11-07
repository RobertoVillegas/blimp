import { describe, expect, it } from "vitest";
import { ARCHIVE_AFTER, staleTabs } from "./select";

const now = Date.UTC(2026, 10, 7, 12);
const tab = (id: number, hoursAgo: number, extra: object = {}) => ({
  id,
  url: `https://example.com/${id}`,
  pinned: false,
  active: false,
  audible: false,
  groupId: -1,
  lastAccessed: now - hoursAgo * 3_600_000,
  ...extra,
});

describe("staleTabs", () => {
  it("archives web tabs unused for longer than the setting", () => {
    const tabs = [tab(1, 13), tab(2, 11), tab(3, 30)];
    expect(staleTabs(tabs, now, ARCHIVE_AFTER["12h"]).map((t) => t.id)).toEqual(
      [1, 3],
    );
    expect(staleTabs(tabs, now, ARCHIVE_AFTER["24h"]).map((t) => t.id)).toEqual(
      [3],
    );
  });

  it("never archives pinned, active, playing, grouped or non-web tabs, or when off", () => {
    const tabs = [
      tab(1, 99, { pinned: true }),
      tab(2, 99, { active: true }),
      tab(3, 99, { audible: true }),
      tab(4, 99, { groupId: 7 }),
      tab(5, 99, { url: "chrome://settings" }),
      tab(6, 99, { lastAccessed: undefined }),
    ];
    expect(staleTabs(tabs, now, ARCHIVE_AFTER["12h"])).toEqual([]);
    expect(staleTabs([tab(7, 999)], now, ARCHIVE_AFTER.off)).toEqual([]);
  });
});
