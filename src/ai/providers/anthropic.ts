import type { ProviderAdapter, ProviderConfig } from '../types';
import { joinUrl } from './http';

function headers(config: ProviderConfig): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': config.apiKey ?? '',
    'anthropic-version': '2023-06-01',
    // Required for any request that carries a browser Origin, including extension origins.
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

export const anthropic: ProviderAdapter = {
  buildRequest(config, request) {
    const body: Record<string, unknown> = {
      model: config.model,
      system: request.system,
      messages: request.messages,
      max_tokens: request.maxOutputTokens ?? 1024,
    };
    if (request.temperature !== undefined) body.temperature = request.temperature;

    return {
      url: joinUrl(config.baseUrl, 'messages'),
      init: {
        method: 'POST',
        headers: headers(config),
        body: JSON.stringify(body),
      },
    };
  },

  parseResponse(body) {
    const blocks = (body as { content?: { type?: string; text?: string }[] })?.content;
    if (!Array.isArray(blocks)) throw new Error('No content in response');
    return blocks
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('');
  },

  modelsRequest(config) {
    return { url: joinUrl(config.baseUrl, 'models?limit=100'), init: { method: 'GET', headers: headers(config) } };
  },

  parseModels(body) {
    const data = (body as { data?: { id?: unknown }[] })?.data;
    return Array.isArray(data) ? data.map((model) => model.id).filter((id): id is string => typeof id === 'string') : [];
  },
};
