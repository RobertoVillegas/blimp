import { describe, expect, it, vi } from 'vitest';
import { searchWeb, toCandidates } from './adapters';
import { bestIndex } from './rank';

const json = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

describe('searchWeb', () => {
  it('calls Brave with the subscription header and maps results', async () => {
    const fetchImpl = json({ web: { results: [{ title: '<strong>React</strong> &amp; you', url: 'https://react.dev/', description: 'The library' }] } });
    const results = await searchWeb({ provider: 'brave', query: 'react docs', baseUrl: '', apiKey: 'k', fetchImpl });
    expect(results).toEqual([{ title: 'React & you', url: 'https://react.dev/', snippet: 'The library' }]);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.search.brave.com/res/v1/web/search?q=react+docs&count=10');
    expect((init!.headers as Record<string, string>)['x-subscription-token']).toBe('k');
  });

  it('calls SearXNG with format=json', async () => {
    const fetchImpl = json({ results: [{ title: 'Vue', url: 'https://vuejs.org', content: 'Progressive' }] });
    await searchWeb({ provider: 'searxng', query: 'vue', baseUrl: 'https://searx.example/', fetchImpl });
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://searx.example/search?q=vue&format=json');
  });

  it('explains how to fix a SearXNG instance without JSON output', async () => {
    await expect(searchWeb({ provider: 'searxng', query: 'x', baseUrl: 'https://s.example', fetchImpl: json({}, 403) })).rejects.toThrow(
      /search.formats/,
    );
  });

  it('requires a key for Brave before calling it', async () => {
    const fetchImpl = json({});
    await expect(searchWeb({ provider: 'brave', query: 'x', baseUrl: '', fetchImpl })).rejects.toMatchObject({ kind: 'not-configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('toCandidates', () => {
  it('keeps only web links, dedupes and caps at 8', () => {
    const raw = [
      { url: 'javascript:alert(1)', title: 'x' },
      { url: 'https://a.com/', title: 'A' },
      { url: 'https://a.com', title: 'A again' },
      ...Array.from({ length: 12 }, (_, i) => ({ url: `https://b.com/${i}`, title: `B${i}` })),
    ];
    const results = toCandidates(raw);
    expect(results[0]!.url).toBe('https://a.com/');
    expect(results).toHaveLength(8);
    expect(results.some((r) => r.url.startsWith('javascript'))).toBe(false);
  });
});

describe('bestIndex', () => {
  it('accepts only numbers that point at a real result', () => {
    expect(bestIndex(2, 3)).toBe(1);
    expect(bestIndex(0, 3)).toBeNull();
    expect(bestIndex(4, 3)).toBeNull();
  });
});
