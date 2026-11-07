import { describe, expect, it } from "vitest";
import { quoteLines, verifyQuotes } from "./quotes";

const page =
  "The Council approved new bike lanes along the river — “a first step,” the mayor said.\nWork starts in March.";

describe("quote verification", () => {
  it("finds quotes that appear verbatim, ignoring case, quote style, dashes and spacing", () => {
    const answer =
      '> the Council approved new bike lanes along the river - "a first step," the mayor said.\nYes, **bike lanes** were approved.\n> Work   starts in March.';
    expect(verifyQuotes(answer, page)).toEqual([
      {
        text: 'the Council approved new bike lanes along the river - "a first step," the mayor said.',
        found: true,
      },
      { text: "Work   starts in March.", found: true },
    ]);
  });

  it("flags quotes the page does not contain", () => {
    expect(verifyQuotes("> The work will finish in June.", page)).toEqual([
      { text: "The work will finish in June.", found: false },
    ]);
  });

  it("ignores very short or empty quote lines", () => {
    expect(quoteLines("> ok\n>\nplain line")).toEqual([]);
  });
});
