import { getApiKey } from '@/storage/secrets';
import { loadSettings, providerSettings, type Settings } from '@/storage/settings';
import type { AiStatus } from '@/shared/types';
import { PROVIDERS, isHostedEndpoint } from './catalog';
import type { ProviderConfig } from './types';

export async function activeProvider(): Promise<{ config: ProviderConfig; settings: Settings }> {
  const settings = await loadSettings();
  const { model, baseUrl } = providerSettings(settings);
  const apiKey = await getApiKey(settings.provider);
  return { config: { id: settings.provider, model, baseUrl, apiKey }, settings };
}

/** What the UI may know about the provider. Contains no key material. */
export async function aiStatus(): Promise<AiStatus> {
  const { config } = await activeProvider();
  const info = PROVIDERS[config.id];
  let problem: string | undefined;
  if (!config.model) problem = 'No model selected.';
  else if (!config.baseUrl) problem = 'No base URL set.';
  else if (info.needsKey && !config.apiKey) problem = 'No API key for this session.';
  return {
    provider: config.id,
    providerLabel: info.label,
    model: config.model,
    configured: !problem,
    hosted: isHostedEndpoint(config.id, config.baseUrl),
    problem,
  };
}
