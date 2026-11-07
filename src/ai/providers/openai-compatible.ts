import type { ProviderAdapter, ProviderConfig } from '../types';
import { joinUrl } from './http';

function headers(config: ProviderConfig, sessionId?: string): Record<string, string> {
  const result: Record<string, string> = { 'content-type': 'application/json', ...config.headers };
  if (config.apiKey) result.authorization = `Bearer ${config.apiKey}`;
  if (config.sessionHeader) result[config.sessionHeader] = sessionId ?? crypto.randomUUID();
  return result;
}

/** OpenAI Chat Completions, also spoken by DeepSeek, Mistral, OpenCode Zen, OpenRouter and most gateways. */
export const openAiCompatible: ProviderAdapter = {
  buildRequest(config, request) {
    const body: Record<string, unknown> = {
      model: config.model,
      messages: [{ role: 'system', content: request.system }, ...request.messages],
    };
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxOutputTokens !== undefined) {
      // OpenAI's current models reject `max_tokens`; compatible servers mostly only know `max_tokens`.
      body[config.adapter === 'openai' ? 'max_completion_tokens' : 'max_tokens'] = request.maxOutputTokens;
    }
    if (request.json) body.response_format = { type: 'json_object' };

    return {
      url: joinUrl(config.baseUrl, 'chat/completions'),
      init: { method: 'POST', headers: headers(config, request.sessionId), body: JSON.stringify(body) },
    };
  },

  parseResponse(body) {
    const content = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
      ?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('');
    }
    throw new Error('No message content in response');
  },

  modelsRequest(config) {
    return { url: joinUrl(config.baseUrl, 'models'), init: { method: 'GET', headers: headers(config) } };
  },

  parseModels(body) {
    const data = (body as { data?: { id?: unknown; api?: Record<string, unknown> }[] })?.data;
    if (!Array.isArray(data)) return [];
    return data
      // Gateways like OpenCode say which API each model speaks; keep only Chat Completions ones.
      .filter((model) => !model.api || 'chat-completions' in model.api)
      .map((model) => model.id)
      .filter((id): id is string => typeof id === 'string');
  },
};
