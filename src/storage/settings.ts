import { z } from 'zod';
import { PRESET_IDS, PRESETS, SEEDED_PRESETS } from '@/ai/presets';
import type { PresetId } from '@/shared/types';

const profileSchema = z.object({
  id: z.string().min(1).max(64),
  preset: z.enum(PRESET_IDS as [PresetId, ...PresetId[]]),
  name: z.string().trim().min(1).max(60),
  model: z.string().trim().max(200).default(''),
  /** Empty means the preset's default base URL. */
  baseUrl: z.string().trim().max(500).default(''),
});

export type Profile = z.infer<typeof profileSchema>;

export const settingsSchema = z.object({
  profiles: z.array(profileSchema).max(50),
  activeProfileId: z.string(),
  temperature: z.number().min(0).max(2).default(0.2),
  maxOutputTokens: z.number().int().min(64).max(32_000).default(1200),
  /** Upper bound on page text sent per request (estimated tokens). */
  maxInputTokens: z.number().int().min(1000).max(200_000).default(12_000),
  keyStorage: z.enum(['session', 'persistent']).default('session'),
  /** F05: Shift-hover previews. Turning it on requests http(s) site access. */
  linkPreviews: z.boolean().default(false),
  /** F07: where Instant Links gets real candidate URLs. */
  search: z
    .object({
      provider: z.enum(['none', 'brave', 'searxng']).default('none'),
      /** SearXNG instance URL; unused for Brave. */
      baseUrl: z.string().trim().max(500).default(''),
    })
    .default({ provider: 'none', baseUrl: '' }),
  /** F08: AI filename suggestions. Turning it on requests the downloads permission. */
  tidyDownloads: z.boolean().default(false),
});

export type Settings = z.infer<typeof settingsSchema>;

const KEY = 'settings';

export function newProfile(preset: PresetId, existing: Profile[] = []): Profile {
  const base = PRESETS[preset].label;
  const taken = new Set(existing.map((profile) => profile.name));
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
  const id = existing.some((profile) => profile.id === preset) ? `${preset}-${crypto.randomUUID().slice(0, 8)}` : preset;
  return { id, preset, name, model: '', baseUrl: '' };
}

export function defaultSettings(): Settings {
  const profiles: Profile[] = [];
  for (const preset of SEEDED_PRESETS) profiles.push(newProfile(preset, profiles));
  return settingsSchema.parse({ profiles, activeProfileId: profiles[0]!.id });
}

/** v0.1 stored one entry per provider; keys were saved under the provider id, which becomes the profile id. */
function migrateV01(stored: unknown): unknown {
  const old = stored as { provider?: PresetId; providers?: Record<string, { model?: string; baseUrl?: string }> } | undefined;
  if (!old?.provider || !old.providers || 'profiles' in old) return stored;
  const settings = defaultSettings();
  for (const [preset, saved] of Object.entries(old.providers)) {
    if (!PRESET_IDS.includes(preset as PresetId)) continue;
    const existing = settings.profiles.find((profile) => profile.id === preset);
    const profile = existing ?? newProfile(preset as PresetId, settings.profiles);
    Object.assign(profile, { model: saved.model ?? '', baseUrl: saved.baseUrl ?? '' });
    if (!existing) settings.profiles.push(profile);
  }
  if (settings.profiles.some((profile) => profile.id === old.provider)) settings.activeProfileId = old.provider;
  return { ...old, profiles: settings.profiles, activeProfileId: settings.activeProfileId };
}

/** The first profiles build seeded OpenCode Zen; it is replaced by OpenCode Go. */
function migrateZenToGo(stored: unknown): unknown {
  const settings = stored as { profiles?: { preset?: string; name?: string; baseUrl?: string }[] } | undefined;
  for (const profile of settings?.profiles ?? []) {
    if (profile.preset !== 'opencode') continue;
    profile.preset = 'opencode-go';
    profile.baseUrl = '';
    if (profile.name === 'OpenCode Zen') profile.name = 'OpenCode Go';
  }
  return stored;
}

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(KEY);
  const parsed = settingsSchema.safeParse(migrateZenToGo(migrateV01(stored[KEY])));
  if (!parsed.success || parsed.data.profiles.length === 0) return defaultSettings();
  const settings = parsed.data;
  if (!settings.profiles.some((profile) => profile.id === settings.activeProfileId)) {
    settings.activeProfileId = settings.profiles[0]!.id;
  }
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [KEY]: settingsSchema.parse(settings) });
}

export function activeProfile(settings: Settings): Profile {
  return settings.profiles.find((profile) => profile.id === settings.activeProfileId) ?? settings.profiles[0]!;
}

export function profileBaseUrl(profile: Profile): string {
  return profile.baseUrl || PRESETS[profile.preset].defaultBaseUrl;
}
