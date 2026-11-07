import { getApiKey } from '@/storage/secrets';
import { activeProfile, loadSettings, profileBaseUrl, type Profile, type Settings } from '@/storage/settings';
import type { AiFeature, AiStatus } from '@/shared/types';
import { PRESETS, adapterFor, isHostedEndpoint } from './presets';
import type { ProviderConfig } from './types';

export function profileConfig(profile: Profile, apiKey: string | undefined): ProviderConfig {
  const preset = PRESETS[profile.preset];
  return {
    adapter: adapterFor(preset, profile.api),
    label: profile.name,
    model: profile.model,
    baseUrl: profileBaseUrl(profile),
    apiKey,
    needsKey: preset.needsKey,
    headers: preset.headers,
    sessionHeader: preset.sessionHeader,
  };
}

/** The profile a feature uses: its own if one is set and still exists, else the active one. */
export function profileFor(settings: Settings, feature?: AiFeature): Profile {
  const id = feature ? settings.featureProfiles[feature] : undefined;
  return settings.profiles.find((profile) => profile.id === id) ?? activeProfile(settings);
}

export async function activeProvider(feature?: AiFeature): Promise<{ config: ProviderConfig; profile: Profile; settings: Settings }> {
  const settings = await loadSettings();
  const profile = profileFor(settings, feature);
  return { config: profileConfig(profile, await getApiKey(profile.id)), profile, settings };
}

/** What the UI may know about the provider. Contains no key material. */
export async function aiStatus(feature?: AiFeature): Promise<AiStatus> {
  const status = await profileStatus(feature);
  if (feature) return status;
  const settings = await loadSettings();
  const byFeature: Partial<Record<AiFeature, AiStatus>> = {};
  for (const [name, id] of Object.entries(settings.featureProfiles) as [AiFeature, string][]) {
    if (id !== settings.activeProfileId && settings.profiles.some((profile) => profile.id === id)) byFeature[name] = await profileStatus(name);
  }
  return Object.keys(byFeature).length ? { ...status, byFeature } : status;
}

async function profileStatus(feature?: AiFeature): Promise<AiStatus> {
  const { config, profile } = await activeProvider(feature);
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
