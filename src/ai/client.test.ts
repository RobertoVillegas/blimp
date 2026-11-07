import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { complete, completeJson, redactKeys } from './client';
import { extractJson } from './json';
import type { ProviderConfig } from './types';

const request = { system: 'sys', messages: [{ role: 'user' as const, content: 'hi' }], maxOutputTokens: 50, temperature: 0 };

function mockFetch(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

function sent(fetchImpl: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchImpl.mock.calls[0]!;
  return { url, headers: init!.headers as Record<string, string>, body: JSON.parse(init!.body as string) };
}

describe('provider wire formats', () => {
  it('OpenAI: chat/completions with bearer key and max_completion_tokens', async () => {
    const fetchImpl = mockFetch(200, { choices: [{ message: { content: 'hello' } }] });
    const config: ProviderConfig = { id: 'openai', model: 'm', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test' };
    expect(await complete(config, { ...request, json: true }, { fetchImpl })).toBe('hello');
    const { url, headers, body } = sent(fetchImpl);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(headers.authorization).toBe('Bearer sk-test');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.max_completion_tokens).toBe(50);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('custom endpoint: no key required, uses max_tokens', async () => {
    const fetchImpl = mockFetch(200, { choices: [{ message: { content: 'ok' } }] });
    await complete({ id: 'custom', model: 'm', baseUrl: 'http://127.0.0.1:8080/v1/' }, request, { fetchImpl });
    const { url, headers, body } = sent(fetchImpl);
    expect(url).toBe('http://127.0.0.1:8080/v1/chat/completions');
    expect(headers.authorization).toBeUndefined();
    expect(body.max_tokens).toBe(50);
  });

  it('Anthropic: messages API with system field and browser-access header', async () => {
    const fetchImpl = mockFetch(200, { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] });
    const config: ProviderConfig = { id: 'anthropic', model: 'claude', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'k' };
    expect(await complete(config, request, { fetchImpl })).toBe('ab');
    const { url, headers, body } = sent(fetchImpl);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('k');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(body.system).toBe('sys');
    expect(body.max_tokens).toBe(50);
  });

  it('Gemini: generateContent with key header, model role and JSON mime type', async () => {
    const fetchImpl = mockFetch(200, { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] });
    const config: ProviderConfig = {
      id: 'gemini',
      model: 'gemini-x',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: 'AIzaTest',
    };
    await complete(
      config,
      { ...request, json: true, messages: [...request.messages, { role: 'assistant', content: 'yo' }] },
      { fetchImpl },
    );
    const { url, headers, body } = sent(fetchImpl);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    expect(headers['x-goog-api-key']).toBe('AIzaTest');
    expect(body.contents[1].role).toBe('model');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('Ollama: /api/chat, non-streaming, JSON format', async () => {
    const fetchImpl = mockFetch(200, { message: { content: 'local' } });
    await complete({ id: 'ollama', model: 'llama', baseUrl: 'http://localhost:11434' }, { ...request, json: true }, { fetchImpl });
    const { url, body } = sent(fetchImpl);
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(body.stream).toBe(false);
    expect(body.format).toBe('json');
    expect(body.options.num_predict).toBe(50);
  });
});

describe('errors', () => {
  const openai: ProviderConfig = { id: 'openai', model: 'm', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x' };

  it('refuses to call a keyed provider without a key', async () => {
    const fetchImpl = mockFetch(200, {});
    await expect(complete({ ...openai, apiKey: undefined }, request, { fetchImpl })).rejects.toMatchObject({
      kind: 'not-configured',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'auth'],
    [429, 'quota'],
    [404, 'model'],
    [500, 'network'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const fetchImpl = mockFetch(status, { error: { message: 'Incorrect API key provided: sk-abcdefghijkl' } });
    const error = await complete(openai, request, { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind });
    expect((error as Error).message).not.toContain('sk-abcdefghijkl');
  });

  it('reports unreachable providers as network errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(complete(openai, request, { fetchImpl })).rejects.toMatchObject({ kind: 'network' });
  });

  it('times out', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))),
    );
    await expect(complete(openai, request, { fetchImpl, timeoutMs: 20 })).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('rejects JSON that fails the schema', async () => {
    const fetchImpl = mockFetch(200, { choices: [{ message: { content: '{"groups": "nope"}' } }] });
    await expect(
      completeJson(openai, request, z.object({ groups: z.array(z.string()) }), { fetchImpl }),
    ).rejects.toMatchObject({ kind: 'invalid-output' });
  });
});

describe('extractJson', () => {
  it('reads plain, fenced and wrapped JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Sure! {"a":3} Hope that helps')).toEqual({ a: 3 });
    expect(extractJson('no json')).toBeUndefined();
  });
});

describe('redactKeys', () => {
  it('removes key-shaped strings', () => {
    expect(redactKeys('bad key sk-proj-abc123456789 and AIzaSyD12345678')).toBe('bad key [redacted] and [redacted]');
  });
});
