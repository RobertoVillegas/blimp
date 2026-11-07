import type { AdapterKind } from '@/shared/types';

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
  /** Stable id for one conversation or operation, sent when the provider wants one. */
  sessionId?: string;
}

export interface ProviderConfig {
  adapter: AdapterKind;
  /** Human name used in errors, e.g. the profile name. */
  label: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  needsKey?: boolean;
  headers?: Record<string, string>;
  sessionHeader?: string;
}

/** Wire format for one protocol: build HTTP requests and read results back out. */
export interface ProviderAdapter {
  buildRequest(config: ProviderConfig, request: CompletionRequest): { url: string; init: RequestInit };
  parseResponse(body: unknown): string;
  modelsRequest(config: ProviderConfig): { url: string; init: RequestInit };
  parseModels(body: unknown): string[];
}
