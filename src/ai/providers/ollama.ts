import type { ProviderAdapter } from '../types';
import { joinUrl } from './http';

export const ollama: ProviderAdapter = {
  buildRequest(config, request) {
    const options: Record<string, unknown> = {};
    if (request.temperature !== undefined) options.temperature = request.temperature;
    if (request.maxOutputTokens !== undefined) options.num_predict = request.maxOutputTokens;

    const body: Record<string, unknown> = {
      model: config.model,
      messages: [{ role: 'system', content: request.system }, ...request.messages],
      stream: false,
      options,
    };
    if (request.json) body.format = 'json';

    return {
      url: joinUrl(config.baseUrl, 'api/chat'),
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    };
  },

  parseResponse(body) {
    const content = (body as { message?: { content?: unknown } })?.message?.content;
    if (typeof content !== 'string') throw new Error('No message in response');
    return content;
  },

  modelsRequest(config) {
    return { url: joinUrl(config.baseUrl, 'api/tags'), init: { method: 'GET' } };
  },

  parseModels(body) {
    const models = (body as { models?: { name?: unknown }[] })?.models;
    if (!Array.isArray(models)) return [];
    return models.map((model) => model.name).filter((name): name is string => typeof name === 'string').map((id) => ({ id }));
  },
};
