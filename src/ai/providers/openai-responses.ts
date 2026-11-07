import type { ProviderAdapter } from '../types';
import { joinUrl } from './http';
import { bearerHeaders, openAiCompatible } from './openai-compatible';

/** Reasoning models spend output tokens thinking, so tiny budgets come back empty. */
const MIN_OUTPUT_TOKENS = 2048;

/** OpenAI Responses API, which OpenCode Go uses for its GPT and Grok models. */
export const openAiResponses: ProviderAdapter = {
  buildRequest(config, request) {
    const body: Record<string, unknown> = {
      model: config.model,
      instructions: request.system,
      input: request.messages.map((message) => ({ role: message.role, content: message.content })),
      store: false,
    };
    if (request.maxOutputTokens !== undefined) body.max_output_tokens = Math.max(request.maxOutputTokens, MIN_OUTPUT_TOKENS);
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.json) body.text = { format: { type: 'json_object' } };
    return {
      url: joinUrl(config.baseUrl, 'responses'),
      init: { method: 'POST', headers: bearerHeaders(config, request.sessionId), body: JSON.stringify(body) },
    };
  },

  parseResponse(body) {
    const response = body as { output_text?: unknown; output?: { type?: string; content?: { type?: string; text?: unknown }[] }[]; status?: string };
    if (typeof response.output_text === 'string' && response.output_text) return response.output_text;
    const text = (response.output ?? [])
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('');
    if (!text) throw new Error(response.status === 'incomplete' ? 'Ran out of output tokens' : 'No text in response');
    return text;
  },

  modelsRequest: openAiCompatible.modelsRequest,
  parseModels: openAiCompatible.parseModels,
};
