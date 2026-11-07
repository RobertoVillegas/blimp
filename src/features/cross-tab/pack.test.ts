import { describe, expect, it } from "vitest";
import { blockedReason } from "./classify";
import { packSources, sourcesBlock } from "./pack";
import { splitCitations } from "@/shared/citations";

const doc = (tabId: number, chars: number) => ({
  tabId,
  title: `T${tabId}`,
  url: `https://e.com/${tabId}`,
  text: "x".repeat(chars),
});

describe("packSources", () => {
  it("fits small tabs in one batch, numbered in order", () => {
    const { batches, overflow } = packSources(
      [doc(7, 400), doc(3, 400)],
      12_000,
    );
    expect(batches).toHaveLength(1);
    expect(batches[0]!.map((s) => [s.n, s.tabId])).toEqual([
      [1, 7],
      [2, 3],
    ]);
    expect(overflow).toEqual([]);
  });

  it("splits into batches for map/reduce and truncates huge tabs", () => {
    const { batches } = packSources(
      [doc(1, 30_000), doc(2, 30_000), doc(3, 400)],
      6_000,
    );
    expect(batches.length).toBeGreaterThan(1);
    expect(batches[0]![0]!.truncated).toBe(true);
    expect(batches.flat().map((s) => s.n)).toEqual([1, 2, 3]);
  });

  it("stops at the batch cap and reports the rest as overflow", () => {
    const docs = Array.from({ length: 10 }, (_, i) => doc(i, 20_000));
    const { batches, overflow } = packSources(docs, 6_000, 4);
    expect(batches).toHaveLength(4);
    expect(overflow.map((d) => d.tabId)).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it("marks sources as untrusted blocks with their number", () => {
    const [batch] = packSources([doc(1, 50)], 12_000).batches;
    expect(sourcesBlock(batch!)).toMatch(
      /^<source n="1">\nTitle: T1\nURL: https:\/\/e.com\/1/,
    );
  });
});

describe("blockedReason", () => {
  it("blocks browser pages, the web store and sleeping tabs", () => {
    expect(
      blockedReason({ id: 1, url: "chrome://settings", discarded: false }),
    ).toMatch(/Browser/);
    expect(
      blockedReason({
        id: 1,
        url: "https://chromewebstore.google.com/x",
        discarded: false,
      }),
    ).toMatch(/cannot read/);
    expect(
      blockedReason({ id: 1, url: "https://e.com", discarded: true }),
    ).toMatch(/Asleep/);
    expect(
      blockedReason({ id: 1, url: "https://e.com", discarded: false }),
    ).toBeUndefined();
  });
});

describe("splitCitations", () => {
  it("turns valid [n] and [n, m] into citations and leaves the rest as text", () => {
    const parts = splitCitations(
      "React is fast [1]. Vue too [2, 3]. Footnote [9] and [a].",
      new Set([1, 2, 3]),
    );
    expect(parts).toEqual([
      { kind: "text", text: "React is fast " },
      { kind: "cite", n: 1 },
      { kind: "text", text: ". Vue too " },
      { kind: "cite", n: 2 },
      { kind: "cite", n: 3 },
      { kind: "text", text: ". Footnote [9] and [a]." },
    ]);
  });
});
