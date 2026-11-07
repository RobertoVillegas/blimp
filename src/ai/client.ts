import type { z } from 'zod';
import type { AdapterKind } from '@/shared/types';
import { UserFacingError } from '@/shared/errors';
import { extractJson } from './json';
import { anthropic } from './providers/anthropic';
import { gemini } from './providers/gemini';
import { ollama } from './providers/ollama';
import { openAiCompatible } from './providers/openai-compatible';
import { openAiResponses } from './providers/openai-responses';
import type { CompletionRequest, ModelInfo, ProviderAdapter, ProviderConfig } from './types';

const ADAPTERS: Record<AdapterKind, ProviderAdapter> = {
  openai: openAiCompatible,
  'openai-compatible': openAiCompatible,
  'openai-responses': openAiResponses,
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
  if (!config.model) throw new UserFacingError('not-configured', 'Choose a model in AI Settings.');
  const adapter = ADAPTERS[config.adapter];
  let body: unknown;
  try {
    body = await send(config, adapter.buildRequest(config, request), request.signal, timeoutMs, fetchImpl);
  } catch (error) {
    // Reasoning models reject temperature and some servers reject JSON mode; retry once without it.
    const retry = error instanceof UserFacingError && error.kind === 'model' ? withoutRejectedParam(request, error.message) : null;
    if (!retry) throw error;
    body = await send(config, adapter.buildRequest(config, retry), request.signal, timeoutMs, fetchImpl);
  }
  try {
    return adapter.parseResponse(body);
  } catch {
    throw new UserFacingError('invalid-output', `${config.label} returned no text. Check the model ID.`);
  }
}

function withoutRejectedParam(request: CompletionRequest, message: string): CompletionRequest | null {
  if (request.temperature !== undefined && /temperature/i.test(message)) return { ...request, temperature: undefined };
  if (request.json && /response_format|json_object|json mode|text\.format/i.test(message)) return { ...request, json: false };
  return null;
}

/** Models the endpoint says this key can use, sorted, one entry per ID. */
export async function listModels(config: ProviderConfig, { fetchImpl = fetch }: CompleteOptions = {}): Promise<ModelInfo[]> {
  const adapter = ADAPTERS[config.adapter];
  const body = await send(config, adapter.modelsRequest(config), undefined, 20_000, fetchImpl);
  const byId = new Map(adapter.parseModels(body).map((model) => [model.id, model]));
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function send(
  config: ProviderConfig,
  { url, init }: { url: string; init: RequestInit },
  cancel: AbortSignal | undefined,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  if (!config.baseUrl) throw new UserFacingError('not-configured', 'Set a base URL in AI Settings.');
  if (config.needsKey && !config.apiKey) {
    throw new UserFacingError('not-configured', `Add the API key for ${config.label} in AI Settings.`);
  }

  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = cancel ? AbortSignal.any([cancel, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal, credentials: 'omit', redirect: 'error' });
  } catch {
    if (cancel?.aborted) throw new UserFacingError('cancelled', 'Cancelled.');
    if (timeout.aborted) {
      throw new UserFacingError('timeout', `${config.label} did not answer within ${timeoutMs / 1000}s.`);
    }
    throw new UserFacingError('network', networkMessage(config));
  }

  if (!response.ok) throw await httpError(response, config.label);
  try {
    return await response.json();
  } catch {
    throw new UserFacingError('invalid-output', `${config.label} returned a response that is not JSON.`);
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

function networkMessage(config: ProviderConfig): string {
  if (config.adapter === 'ollama') {
    return 'Could not reach Ollama. Make sure it is running and allows extension origins (OLLAMA_ORIGINS="chrome-extension://*").';
  }
  return `Could not reach ${config.label}. Check the base URL, your connection, and that site access was granted in AI Settings.`;
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
