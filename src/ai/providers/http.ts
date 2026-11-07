import type { CompletionRequest, ProviderConfig } from '../types';

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Add the provider's per-conversation header (OpenCode Go rejects requests without one). */
export function withSession(headers: Record<string, string>, config: ProviderConfig, request?: Pick<CompletionRequest, 'sessionId'>) {
  if (config.sessionHeader) headers[config.sessionHeader] = request?.sessionId ?? crypto.randomUUID();
  return headers;
}
