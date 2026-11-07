import { describe, expect, it, vi } from "vitest";
import { compareVersions, fetchUpdate, pickUpdate } from "./check";

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/RobertoVillegas/blimp/releases/tag/${tag}`,
  assets: [
    {
      name: `blimp-${tag.slice(1)}-chrome.zip`,
      browser_download_url: `https://github.com/RobertoVillegas/blimp/releases/download/${tag}/blimp-${tag.slice(1)}-chrome.zip`,
    },
    {
      name: "blimp-chrome.zip",
      browser_download_url:
        "https://github.com/RobertoVillegas/blimp/releases/download/x/blimp-chrome.zip",
    },
  ],
  ...extra,
});

describe("compareVersions", () => {
  it("compares numerically", () => {
    expect(compareVersions("0.10.0", "0.9.3")).toBe(1);
    expect(compareVersions("v0.2.0", "0.2")).toBe(0);
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
  });
});

describe("pickUpdate", () => {
  it("returns the newest release above the current version with its versioned zip", () => {
    const update = pickUpdate(
      [release("v0.2.0"), release("v0.4.0"), release("v0.3.0")],
      "0.2.0",
    );
    expect(update).toEqual({
      version: "0.4.0",
      pageUrl: "https://github.com/RobertoVillegas/blimp/releases/tag/v0.4.0",
      downloadUrl:
        "https://github.com/RobertoVillegas/blimp/releases/download/v0.4.0/blimp-0.4.0-chrome.zip",
    });
  });

  it("ignores drafts, pre-releases, odd tags and the current version", () => {
    const releases = [
      release("v0.3.0", { draft: true }),
      release("v0.3.1", { prerelease: true }),
      release("nightly"),
      release("v0.2.0"),
    ];
    expect(pickUpdate(releases, "0.2.0")).toBeNull();
  });

  it("refuses links outside this repository", () => {
    expect(
      pickUpdate(
        [release("v9.0.0", { html_url: "https://evil.example/" })],
        "0.2.0",
      ),
    ).toBeNull();
    const bad = release("v9.0.0", {
      assets: [
        {
          name: "blimp-9.0.0-chrome.zip",
          browser_download_url: "https://evil.example/x.zip",
        },
      ],
    });
    expect(pickUpdate([bad], "0.2.0")).toBeNull();
  });
});

describe("the old project name", () => {
  it("still trusts releases published as Blimp", () => {
    const old = {
      tag_name: "v0.5.0",
      html_url:
        "https://github.com/RobertoVillegas/helium-max/releases/tag/v0.5.0",
      assets: [
        {
          name: "helium-max-0.5.0-chrome.zip",
          browser_download_url:
            "https://github.com/RobertoVillegas/helium-max/releases/download/v0.5.0/helium-max-0.5.0-chrome.zip",
        },
      ],
    };
    expect(pickUpdate([old], "0.4.0")?.downloadUrl).toBe(
      "https://github.com/RobertoVillegas/helium-max/releases/download/v0.5.0/helium-max-0.5.0-chrome.zip",
    );
  });
});

describe("fetchUpdate", () => {
  it("asks the GitHub releases API without cookies", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify([release("v0.3.0")])),
    );
    expect((await fetchUpdate("0.2.0", fetchImpl))?.version).toBe("0.3.0");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "https://api.github.com/repos/RobertoVillegas/blimp/releases?per_page=10",
    );
    expect(init!.credentials).toBe("omit");
  });
});
