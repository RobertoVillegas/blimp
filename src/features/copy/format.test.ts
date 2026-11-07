import { describe, expect, it } from "vitest";
import { markdownLink, markdownQuote } from "./format";

describe("copy formats", () => {
  it("escapes brackets in titles and parentheses in URLs", () => {
    expect(
      markdownLink("Arrays [MDN]", "https://en.wikipedia.org/wiki/Foo_(bar)"),
    ).toBe("[Arrays \\[MDN\\]](https://en.wikipedia.org/wiki/Foo_%28bar%29)");
    expect(markdownLink("  ", "https://x.com")).toBe(
      "[https://x.com](https://x.com)",
    );
  });

  it("quotes every line and credits the page", () => {
    expect(
      markdownQuote("First line\nSecond line", "Page", "https://e.com"),
    ).toBe("> First line\n> Second line\n>\n> — [Page](https://e.com)");
  });
});
