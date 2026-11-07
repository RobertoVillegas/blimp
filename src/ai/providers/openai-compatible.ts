import type { ModelApi } from '@/shared/types';
import type { ModelInfo, ProviderAdapter, ProviderConfig } from '../types';
import { joinUrl, withSession } from './http';

export function bearerHeaders(config: ProviderConfig, sessionId?: string): Record<string, string> {
  const result: Record<string, string> = { 'content-type': 'application/json', ...config.headers };
  if (config.apiKey) result.authorization = `Bearer ${config.apiKey}`;
  return withSession(result, config, { sessionId });
}

const API_NAMES: Record<string, ModelApi> = { 'chat-completions': 'chat', messages: 'messages', responses: 'responses' };

/** OpenAI-style model list. Gateways like OpenCode also say which API serves each model. */
export function parseOpenAiModels(body: unknown): ModelInfo[] {
  const data = (body as { data?: { id?: unknown; api?: Record<string, unknown> }[] })?.data;
  if (!Array.isArray(data)) return [];
  const models: ModelInfo[] = [];
  for (const model of data) {
    if (typeof model.id !== 'string') continue;
    if (!model.api) {
      models.push({ id: model.id });
      continue;
    }
    // Prefer Chat Completions when a model is served on several APIs; skip APIs we don't speak.
    const api = (['chat-completions', 'messages', 'responses'] as const).find((name) => name in model.api!);
    if (api) models.push({ id: model.id, api: API_NAMES[api] });
  }
  return models;
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
      init: { method: 'POST', headers: bearerHeaders(config, request.sessionId), body: JSON.stringify(body) },
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
    return { url: joinUrl(config.baseUrl, 'models'), init: { method: 'GET', headers: bearerHeaders(config) } };
  },

  parseModels: parseOpenAiModels,
};
