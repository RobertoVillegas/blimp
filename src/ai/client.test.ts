import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { profileConfig } from './active';
import { complete, completeJson, listModels, redactKeys } from './client';
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
    const config: ProviderConfig = { adapter: 'openai', label: 'OpenAI', model: 'm', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test', needsKey: true };
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
    await complete({ adapter: 'openai-compatible', label: 'Local', model: 'm', baseUrl: 'http://127.0.0.1:8080/v1/' }, request, { fetchImpl });
    const { url, headers, body } = sent(fetchImpl);
    expect(url).toBe('http://127.0.0.1:8080/v1/chat/completions');
    expect(headers.authorization).toBeUndefined();
    expect(body.max_tokens).toBe(50);
  });

  it('Anthropic: messages API with system field and browser-access header', async () => {
    const fetchImpl = mockFetch(200, { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] });
    const config: ProviderConfig = { adapter: 'anthropic', label: 'Anthropic', model: 'claude', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'k' };
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
      adapter: 'gemini',
      label: 'Gemini',
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
    await complete({ adapter: 'ollama', label: 'Ollama', model: 'llama', baseUrl: 'http://localhost:11434' }, { ...request, json: true }, { fetchImpl });
    const { url, body } = sent(fetchImpl);
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(body.stream).toBe(false);
    expect(body.format).toBe('json');
    expect(body.options.num_predict).toBe(50);
  });
});

describe('presets', () => {
  const ok = () => mockFetch(200, { choices: [{ message: { content: 'ok' } }] });
  const profile = (preset: 'deepseek' | 'mistral' | 'opencode-go' | 'openrouter') =>
    profileConfig({ id: preset, preset, name: preset, model: 'm', baseUrl: '' }, 'key');

  it.each([
    ['deepseek', 'https://api.deepseek.com/chat/completions'],
    ['mistral', 'https://api.mistral.ai/v1/chat/completions'],
    ['opencode-go', 'https://opencode.ai/zen/go/v1/chat/completions'],
    ['openrouter', 'https://openrouter.ai/api/v1/chat/completions'],
  ] as const)('%s speaks Chat Completions at %s with max_tokens', async (preset, expected) => {
    const fetchImpl = ok();
    await complete(profile(preset), request, { fetchImpl });
    const { url, headers, body } = sent(fetchImpl);
    expect(url).toBe(expected);
    expect(headers.authorization).toBe('Bearer key');
    expect(body.max_tokens).toBe(50);
    expect(body.max_completion_tokens).toBeUndefined();
  });

  it('OpenCode Go sends a stable session id per conversation', async () => {
    const fetchImpl = ok();
    await complete(profile('opencode-go'), { ...request, sessionId: 'conv-1' }, { fetchImpl });
    await complete(profile('opencode-go'), { ...request, sessionId: 'conv-1' }, { fetchImpl });
    const ids = fetchImpl.mock.calls.map(([, init]) => (init!.headers as Record<string, string>)['x-opencode-session']);
    expect(ids).toEqual(['conv-1', 'conv-1']);

    await complete(profile('opencode-go'), request, { fetchImpl });
    const fresh = fetchImpl.mock.calls[2]![1]!.headers as Record<string, string>;
    expect(fresh['x-opencode-session']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('other presets send no session header', async () => {
    const fetchImpl = ok();
    await complete(profile('deepseek'), { ...request, sessionId: 'conv-1' }, { fetchImpl });
    expect(sent(fetchImpl).headers['x-opencode-session']).toBeUndefined();
  });

  it('OpenRouter identifies the app', async () => {
    const fetchImpl = ok();
    await complete(profile('openrouter'), request, { fetchImpl });
    expect(sent(fetchImpl).headers['x-title']).toBe('Helium Max');
  });

  it('keyed presets refuse to run without a key', async () => {
    const fetchImpl = ok();
    const config = profileConfig({ id: 'deepseek', preset: 'deepseek', name: 'DeepSeek', model: 'm', baseUrl: '' }, undefined);
    await expect(complete(config, request, { fetchImpl })).rejects.toThrow('Add the API key for DeepSeek');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('OpenCode Go models on other APIs', () => {
  const go = (api: 'chat' | 'messages' | 'responses' | undefined) =>
    profileConfig({ id: 'go', preset: 'opencode-go', name: 'Go', model: 'm', baseUrl: '', api }, 'key');

  it('Claude/Qwen models use Anthropic Messages with x-api-key and the session header', async () => {
    const fetchImpl = mockFetch(200, { content: [{ type: 'text', text: 'hi' }] });
    expect(await complete(go('messages'), { ...request, sessionId: 's1' }, { fetchImpl })).toBe('hi');
    const { url, headers } = sent(fetchImpl);
    expect(url).toBe('https://opencode.ai/zen/go/v1/messages');
    expect(headers['x-api-key']).toBe('key');
    expect(headers['x-opencode-session']).toBe('s1');
  });

  it('GPT/Grok models use OpenAI Responses with a reasoning-safe token budget', async () => {
    const fetchImpl = mockFetch(200, {
      status: 'completed',
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', content: [{ type: 'output_text', text: '{"a":1}' }] },
      ],
    });
    expect(await complete(go('responses'), { ...request, json: true, sessionId: 's2' }, { fetchImpl })).toBe('{"a":1}');
    const { url, headers, body } = sent(fetchImpl);
    expect(url).toBe('https://opencode.ai/zen/go/v1/responses');
    expect(headers.authorization).toBe('Bearer key');
    expect(headers['x-opencode-session']).toBe('s2');
    expect(body).toMatchObject({ instructions: 'sys', input: [{ role: 'user', content: 'hi' }], store: false, text: { format: { type: 'json_object' } } });
    expect(body.max_output_tokens).toBe(2048);
  });

  it('explains when a reasoning model used up its budget', async () => {
    const fetchImpl = mockFetch(200, { status: 'incomplete', output: [{ type: 'reasoning' }] });
    await expect(complete(go('responses'), request, { fetchImpl })).rejects.toMatchObject({ kind: 'invalid-output' });
  });

  it('ignores an API the preset does not allow', () => {
    const deepseek = profileConfig({ id: 'd', preset: 'deepseek', name: 'D', model: 'm', baseUrl: '', api: 'responses' }, 'k');
    expect(deepseek.adapter).toBe('openai-compatible');
  });
});

describe('rejected parameters', () => {
  const openai: ProviderConfig = { adapter: 'openai', label: 'OpenAI', model: 'gpt-x', baseUrl: 'https://api.openai.com/v1', apiKey: 'k' };

  it('retries once without temperature when the model rejects it', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Unsupported parameter: 'temperature' is not supported with this model." } }), { status: 400 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })));
    expect(await complete(openai, { ...request, temperature: 0.2 }, { fetchImpl })).toBe('ok');
    const retried = JSON.parse(fetchImpl.mock.calls[1]![1]!.body as string);
    expect(retried.temperature).toBeUndefined();
  });

  it('retries without JSON mode when the server rejects response_format', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'response_format is not supported' } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] })));
    await complete(openai, { ...request, json: true }, { fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[1]![1]!.body as string).response_format).toBeUndefined();
  });

  it('does not retry other 400s', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 400 }));
    await expect(complete(openai, request, { fetchImpl })).rejects.toMatchObject({ kind: 'model' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('listModels', () => {
  it('reads OpenAI-style, Gemini and Ollama model lists', async () => {
    const compatible = { adapter: 'openai-compatible' as const, label: 'M', model: '', baseUrl: 'https://api.mistral.ai/v1', apiKey: 'k' };
    const openAiFetch = mockFetch(200, { data: [{ id: 'b-model' }, { id: 'a-model' }, { id: 'a-model' }] });
    expect(await listModels(compatible, { fetchImpl: openAiFetch })).toEqual([{ id: 'a-model' }, { id: 'b-model' }]);
    expect(openAiFetch.mock.calls[0]![0]).toBe('https://api.mistral.ai/v1/models');

    const goFetch = mockFetch(200, {
      data: [
        { id: 'deepseek-v4.1-flash', api: { 'chat-completions': {} } },
        { id: 'claude-haiku-5-5', api: { messages: {} } },
        { id: 'gpt-6-luna', api: { responses: {} } },
        { id: 'gemini-4-argon', api: { 'generate-content': {} } },
      ],
    });
    expect(await listModels(compatible, { fetchImpl: goFetch })).toEqual([
      { id: 'claude-haiku-5-5', api: 'messages' },
      { id: 'deepseek-v4.1-flash', api: 'chat' },
      { id: 'gpt-6-luna', api: 'responses' },
    ]);

    const geminiFetch = mockFetch(200, {
      models: [
        { name: 'models/gemini-x', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] },
      ],
    });
    const gemini = { adapter: 'gemini' as const, label: 'G', model: '', baseUrl: 'https://g/v1beta', apiKey: 'k' };
    expect(await listModels(gemini, { fetchImpl: geminiFetch })).toEqual([{ id: 'gemini-x' }]);

    const ollamaFetch = mockFetch(200, { models: [{ name: 'llama3.2:latest' }] });
    const ollama = { adapter: 'ollama' as const, label: 'O', model: '', baseUrl: 'http://localhost:11434' };
    expect(await listModels(ollama, { fetchImpl: ollamaFetch })).toEqual([{ id: 'llama3.2:latest' }]);
    expect(ollamaFetch.mock.calls[0]![0]).toBe('http://localhost:11434/api/tags');
  });
});

describe('errors', () => {
  const openai: ProviderConfig = { adapter: 'openai', label: 'OpenAI', model: 'm', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x', needsKey: true };

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
