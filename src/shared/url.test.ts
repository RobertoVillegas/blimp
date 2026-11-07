import { describe, expect, it } from 'vitest';
import { canInjectInto, isHttpUrl, originPattern } from './url';

describe('url guards', () => {
  it('accepts only http(s)', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    for (const value of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'chrome://settings', 'nonsense']) {
      expect(isHttpUrl(value)).toBe(false);
    }
  });

  it('does not try to inject into browser pages or the web store', () => {
    expect(canInjectInto('https://example.com/a')).toBe(true);
    expect(canInjectInto('chrome://newtab')).toBe(false);
    expect(canInjectInto('https://chromewebstore.google.com/detail/x')).toBe(false);
    expect(canInjectInto(undefined)).toBe(false);
  });

  it('builds origin permission patterns', () => {
    expect(originPattern('https://api.openai.com/v1')).toBe('https://api.openai.com/*');
    expect(originPattern('http://localhost:11434')).toBe('http://localhost/*');
    expect(originPattern('ftp://x')).toBeNull();
  });
});

describe('isSecureEndpoint', () => {
  it('allows https anywhere and http only to this machine', async () => {
    const { isSecureEndpoint } = await import('./url');
    expect(isSecureEndpoint('https://api.deepseek.com')).toBe(true);
    expect(isSecureEndpoint('http://localhost:11434')).toBe(true);
    expect(isSecureEndpoint('http://127.0.0.1:8080/v1')).toBe(true);
    expect(isSecureEndpoint('http://my-server.lan/v1')).toBe(false);
    expect(isSecureEndpoint('http://192.168.1.5:11434')).toBe(false);
    expect(isSecureEndpoint('ftp://x')).toBe(false);
  });
});
