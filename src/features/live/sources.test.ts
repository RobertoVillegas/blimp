import { describe, expect, it, vi } from "vitest";
import {
  fetchGithub,
  githubSearchUrl,
  parseFeed,
  parseGithubSearch,
} from "./sources";

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>Example Blog</title><link>https://blog.example.com</link>
<item><title>Hello &amp; welcome</title><link>https://blog.example.com/hello</link><guid>post-1</guid>
<pubDate>Fri, 06 Nov 2026 10:00:00 GMT</pubDate><dc:creator>Ana</dc:creator></item>
<item><title><![CDATA[Second <b>post</b>]]></title><link>/second</link><pubDate>nonsense</pubDate></item>
<item><title>Bad</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Releases</title>
<entry><id>tag:github.com,2008:Repository/1/v2.0.0</id><title>v2.0.0</title>
<link rel="alternate" type="text/html" href="https://github.com/acme/tool/releases/tag/v2.0.0"/>
<updated>2026-11-05T12:00:00Z</updated><author><name>octocat</name><email>x@example.com</email></author></entry>
</feed>`;

describe("parseFeed", () => {
  it("reads RSS: entities, CDATA, relative links, dates, and drops non-web links", () => {
    const feed = parseFeed(RSS, "https://blog.example.com/feed.xml");
    expect(feed.title).toBe("Example Blog");
    expect(feed.items).toEqual([
      {
        id: "post-1",
        title: "Hello & welcome",
        url: "https://blog.example.com/hello",
        subtitle: "Ana",
        date: "2026-11-06T10:00:00.000Z",
      },
      {
        id: "https://blog.example.com/second",
        title: "Second post",
        url: "https://blog.example.com/second",
        subtitle: "",
        date: "",
      },
    ]);
  });

  it("reads Atom", () => {
    expect(
      parseFeed(ATOM, "https://github.com/acme/tool/releases.atom"),
    ).toEqual({
      title: "Releases",
      items: [
        {
          id: "tag:github.com,2008:Repository/1/v2.0.0",
          title: "v2.0.0",
          url: "https://github.com/acme/tool/releases/tag/v2.0.0",
          subtitle: "octocat",
          date: "2026-11-05T12:00:00.000Z",
        },
      ],
    });
  });

  it("rejects pages that are not feeds", () => {
    expect(() =>
      parseFeed("<html><body>hi</body></html>", "https://x.com"),
    ).toThrow(/not an RSS or Atom feed/);
  });
});

describe("GitHub", () => {
  it("searches with the token and maps issues and PRs", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                id: 7,
                title: "Fix login",
                html_url: "https://github.com/acme/web/pull/42",
                number: 42,
                repository_url: "https://api.github.com/repos/acme/web",
                updated_at: "2026-11-06T09:00:00Z",
                user: { login: "ana" },
              },
              {
                id: 8,
                title: "Phish",
                html_url: "https://evil.example/x",
                number: 1,
              },
            ],
          }),
        ),
    );
    const items = await fetchGithub(
      "is:open is:pr review-requested:@me",
      "ghp_x",
      { fetchImpl },
    );
    expect(items).toEqual([
      {
        id: "7",
        title: "Fix login",
        url: "https://github.com/acme/web/pull/42",
        subtitle: "acme/web#42 · ana",
        date: "2026-11-06T09:00:00Z",
      },
    ]);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(githubSearchUrl("is:open is:pr review-requested:@me"));
    expect((init!.headers as Record<string, string>).authorization).toBe(
      "Bearer ghp_x",
    );
  });

  it("explains a missing or rejected token", async () => {
    await expect(fetchGithub("x", undefined)).rejects.toThrow(
      /Add a GitHub token/,
    );
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 401 }),
    );
    await expect(fetchGithub("x", "bad", { fetchImpl })).rejects.toThrow(
      /rejected the token/,
    );
    expect(parseGithubSearch({})).toEqual([]);
  });
});
