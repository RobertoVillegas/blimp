import type { ProviderAdapter } from '../types';
import { joinUrl } from './http';

/** OpenAI Chat Completions, also spoken by OpenRouter and most self-hosted gateways. */
export const openAiCompatible: ProviderAdapter = {
  buildRequest(config, request) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
    if (config.id === 'openrouter') headers['x-title'] = 'Helium Max';

    const body: Record<string, unknown> = {
      model: config.model,
      messages: [{ role: 'system', content: request.system }, ...request.messages],
    };
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxOutputTokens !== undefined) {
      // OpenAI's current models reject `max_tokens`; compatible servers mostly only know `max_tokens`.
      body[config.id === 'openai' ? 'max_completion_tokens' : 'max_tokens'] = request.maxOutputTokens;
    }
    if (request.json) body.response_format = { type: 'json_object' };

    return {
      url: joinUrl(config.baseUrl, 'chat/completions'),
      init: { method: 'POST', headers, body: JSON.stringify(body) },
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
};
