import type { z } from 'zod';
import type { ProviderId } from '@/shared/types';
import { UserFacingError } from '@/shared/errors';
import { PROVIDERS } from './catalog';
import { extractJson } from './json';
import { anthropic } from './providers/anthropic';
import { gemini } from './providers/gemini';
import { ollama } from './providers/ollama';
import { openAiCompatible } from './providers/openai-compatible';
import type { CompletionRequest, ProviderAdapter, ProviderConfig } from './types';

const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  openai: openAiCompatible,
  openrouter: openAiCompatible,
  custom: openAiCompatible,
  anthropic,
  gemini,
  ollama,
};

const DEFAULT_TIMEOUT_MS = 60_000;

export interface CompleteOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function complete(
  config: ProviderConfig,
  request: CompletionRequest,
  { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch }: CompleteOptions = {},
): Promise<string> {
  const info = PROVIDERS[config.id];
  if (!config.model) throw new UserFacingError('not-configured', 'Choose a model in AI Settings.');
  if (!config.baseUrl) throw new UserFacingError('not-configured', 'Set a base URL in AI Settings.');
  if (info.needsKey && !config.apiKey) {
    throw new UserFacingError('not-configured', `Add your ${info.label} API key in AI Settings.`);
  }

  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
  const { url, init } = ADAPTERS[config.id].buildRequest(config, request);

  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal, credentials: 'omit', redirect: 'error' });
  } catch (error) {
    if (request.signal?.aborted) throw new UserFacingError('cancelled', 'Cancelled.');
    if (timeout.aborted) {
      throw new UserFacingError('timeout', `${info.label} did not answer within ${timeoutMs / 1000}s.`);
    }
    throw new UserFacingError('network', networkMessage(config.id, info.label));
  }

  if (!response.ok) throw await httpError(response, info.label);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new UserFacingError('invalid-output', `${info.label} returned a response that is not JSON.`);
  }
  try {
    return ADAPTERS[config.id].parseResponse(body);
  } catch {
    throw new UserFacingError('invalid-output', `${info.label} returned no text. Check the model ID.`);
  }
}

/** Completion whose text must parse as JSON and match `schema`. Callers decide what to do on failure. */
export async function completeJson<T>(
  config: ProviderConfig,
  request: CompletionRequest,
  schema: z.ZodType<T>,
  options?: CompleteOptions,
): Promise<T> {
  const text = await complete(config, { ...request, json: true }, options);
  const parsed = schema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new UserFacingError(
      'invalid-output',
      'The model returned a plan that did not pass validation. Nothing was changed; try again or use a stronger model.',
    );
  }
  return parsed.data;
}

function networkMessage(id: ProviderId, label: string): string {
  if (id === 'ollama') {
    return 'Could not reach Ollama. Make sure it is running and allows extension origins (OLLAMA_ORIGINS="chrome-extension://*").';
  }
  if (id === 'custom') return 'Could not reach the custom endpoint. Check the base URL and that it allows CORS.';
  return `Could not reach ${label}. Check your connection and that the API permission was granted.`;
}

async function httpError(response: Response, label: string): Promise<UserFacingError> {
  const detail = await readErrorDetail(response);
  const suffix = detail ? ` (${detail})` : '';
  switch (response.status) {
    case 401:
    case 403:
      return new UserFacingError('auth', `${label} rejected the API key${suffix}.`);
    case 402:
    case 429:
      return new UserFacingError('quota', `${label} rate limit or quota reached${suffix}. Wait or check billing.`);
    case 404:
      return new UserFacingError('model', `${label} could not find that model or endpoint${suffix}.`);
    case 400:
    case 422:
      return new UserFacingError('model', `${label} rejected the request${suffix}.`);
    default:
      return new UserFacingError('network', `${label} returned HTTP ${response.status}${suffix}.`);
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } | string; message?: unknown };
    const message =
      typeof body.error === 'string'
        ? body.error
        : typeof body.error?.message === 'string'
          ? body.error.message
          : typeof body.message === 'string'
            ? body.message
            : '';
    return redactKeys(message).slice(0, 160);
  } catch {
    return '';
  }
}

/** Providers sometimes echo part of a bad key back; never surface anything key-shaped. */
export function redactKeys(text: string): string {
  return text.replace(/\b(sk|key|AIza)[-_A-Za-z0-9]{8,}/g, '[redacted]');
}
