import { describe, expect, it } from "vitest";
import { pickRecent } from ".";

describe("pickRecent", () => {
  it("keeps the newest visit per page on that exact site, without the current page", () => {
    const items = [
      {
        url: "https://www.notion.so/Roadmap-1",
        title: "Roadmap",
        lastVisitTime: 10,
      },
      {
        url: "https://www.notion.so/Roadmap-1#section",
        title: "Roadmap",
        lastVisitTime: 30,
      },
      {
        url: "https://www.notion.so/Notes-2",
        title: "Notes",
        lastVisitTime: 20,
      },
      {
        url: "https://notion.so.evil.example/x",
        title: "Fake",
        lastVisitTime: 40,
      },
      {
        url: "https://www.notion.so/Current",
        title: "Current",
        lastVisitTime: 50,
      },
    ];
    expect(
      pickRecent(items, "www.notion.so", "https://www.notion.so/Current").map(
        (p) => p.title,
      ),
    ).toEqual(["Roadmap", "Notes"]);
  });
});
