import { describe, expect, it, vi } from 'vitest';
import { fetchPreviewHtml, MAX_HTML_BYTES } from './fetch';
import { isPrivateHost, normalizePreviewUrl } from './guard';

describe('isPrivateHost', () => {
  it.each(['localhost', 'api.localhost', '127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.101.1.2', '[::1]', 'fd12::1', 'fe80::1', 'printer.local', 'box.tail1234.ts.net', 'intranet', '0.0.0.0'])(
    '%s is private',
    (host) => expect(isPrivateHost(host)).toBe(true),
  );
  it.each(['example.com', '8.8.8.8', '172.32.0.1', '100.128.0.1', 'react.dev'])('%s is public', (host) =>
    expect(isPrivateHost(host)).toBe(false),
  );
});

describe('normalizePreviewUrl', () => {
  it('drops fragments and tracking parameters', () => {
    expect(normalizePreviewUrl('https://Example.com/a?utm_source=x&id=2#top')).toBe('https://example.com/a?id=2');
  });
});

describe('fetchPreviewHtml', () => {
  const html = (body: string, init: ResponseInit = {}, url = 'https://example.com/a') => {
    const response = new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
    Object.defineProperty(response, 'url', { value: url });
    return vi.fn<typeof fetch>(async () => response);
  };

  it('fetches without cookies', async () => {
    const fetchImpl = html('<p>hi</p>');
    expect(await fetchPreviewHtml('https://example.com/a', { fetchImpl })).toEqual({
      kind: 'html',
      html: '<p>hi</p>',
      finalUrl: 'https://example.com/a',
    });
    expect(fetchImpl.mock.calls[0]![1]!.credentials).toBe('omit');
  });

  it('never requests private targets', async () => {
    const fetchImpl = html('');
    expect((await fetchPreviewHtml('http://192.168.0.1/admin', { fetchImpl })).kind).toBe('unavailable');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a redirect that lands on a private host', async () => {
    const result = await fetchPreviewHtml('https://example.com/r', { fetchImpl: html('<p>x</p>', {}, 'http://10.0.0.5/') });
    expect(result).toMatchObject({ kind: 'unavailable', reason: 'Redirected to a local address' });
  });

  it('reports sign-in walls and non-HTML', async () => {
    expect(await fetchPreviewHtml('https://example.com/a', { fetchImpl: html('', { status: 403 }) })).toMatchObject({
      reason: 'Needs sign-in or blocks previews',
    });
    const pdf = vi.fn<typeof fetch>(async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }));
    expect(await fetchPreviewHtml('https://example.com/a.pdf', { fetchImpl: pdf })).toMatchObject({
      reason: 'Not a web page (application/pdf)',
    });
  });

  it('caps the body size', async () => {
    const result = await fetchPreviewHtml('https://example.com/a', { fetchImpl: html('x'.repeat(MAX_HTML_BYTES * 2)) });
    expect(result.kind === 'html' && result.html.length).toBeLessThan(MAX_HTML_BYTES * 2);
  });
});
