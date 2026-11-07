import type { ProviderId } from '@/shared/types';
import type { ProviderInfo } from './types';

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    hosted: true,
    needsKey: true,
    editableBaseUrl: false,
    defaultBaseUrl: 'https://api.openai.com/v1',
    modelPlaceholder: 'gpt-5-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    hosted: true,
    needsKey: true,
    editableBaseUrl: false,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    modelPlaceholder: 'claude-haiku-5-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    hosted: true,
    needsKey: true,
    editableBaseUrl: false,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelPlaceholder: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    hosted: true,
    needsKey: true,
    editableBaseUrl: false,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    modelPlaceholder: 'anthropic/claude-haiku-5.5',
    keyUrl: 'https://openrouter.ai/keys',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    hosted: false,
    needsKey: false,
    editableBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    modelPlaceholder: 'llama3.2',
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    hosted: true,
    needsKey: false,
    editableBaseUrl: true,
    defaultBaseUrl: '',
    modelPlaceholder: 'model-id',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

/** A custom endpoint on loopback stays on this machine; anything else is treated as hosted. */
export function isHostedEndpoint(id: ProviderId, baseUrl: string): boolean {
  if (id === 'ollama') return false;
  if (id !== 'custom') return true;
  try {
    const host = new URL(baseUrl).hostname;
    return !(host === 'localhost' || host === '127.0.0.1' || host === '[::1]');
  } catch {
    return true;
  }
}
