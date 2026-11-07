import { getApiKey } from '@/storage/secrets';
import { activeProfile, loadSettings, profileBaseUrl, type Profile, type Settings } from '@/storage/settings';
import type { AiStatus } from '@/shared/types';
import { PRESETS, isHostedEndpoint } from './presets';
import type { ProviderConfig } from './types';

export function profileConfig(profile: Profile, apiKey: string | undefined): ProviderConfig {
  const preset = PRESETS[profile.preset];
  return {
    adapter: preset.adapter,
    label: profile.name,
    model: profile.model,
    baseUrl: profileBaseUrl(profile),
    apiKey,
    needsKey: preset.needsKey,
    headers: preset.headers,
    sessionHeader: preset.sessionHeader,
  };
}

export async function activeProvider(): Promise<{ config: ProviderConfig; profile: Profile; settings: Settings }> {
  const settings = await loadSettings();
  const profile = activeProfile(settings);
  return { config: profileConfig(profile, await getApiKey(profile.id)), profile, settings };
}

/** What the UI may know about the provider. Contains no key material. */
export async function aiStatus(): Promise<AiStatus> {
  const { config, profile } = await activeProvider();
  let problem: string | undefined;
  if (!config.model) problem = 'No model selected.';
  else if (!config.baseUrl) problem = 'No base URL set.';
  else if (config.needsKey && !config.apiKey) problem = 'No API key for this session.';
  return {
    profileId: profile.id,
    profileName: profile.name,
    model: config.model,
    configured: !problem,
    hosted: isHostedEndpoint(profile.preset, config.baseUrl),
    problem,
  };
}
