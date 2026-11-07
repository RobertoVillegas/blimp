import type { ProviderId } from '@/shared/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  /** Ask the provider for a JSON object when it supports a JSON mode. The result is still validated. */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface ProviderConfig {
  id: ProviderId;
  model: string;
  baseUrl: string;
  apiKey?: string;
}

/** Wire format for one provider: build the HTTP request and read the text back out. */
export interface ProviderAdapter {
  buildRequest(config: ProviderConfig, request: CompletionRequest): { url: string; init: RequestInit };
  parseResponse(body: unknown): string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  hosted: boolean;
  needsKey: boolean;
  /** Users may edit the base URL (proxies, Azure-style gateways, remote Ollama). */
  editableBaseUrl: boolean;
  defaultBaseUrl: string;
  modelPlaceholder: string;
  keyUrl?: string;
}
