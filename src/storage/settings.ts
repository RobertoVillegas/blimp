import { z } from 'zod';
import { PROVIDER_IDS, PROVIDERS } from '@/ai/catalog';
import type { ProviderId } from '@/shared/types';

const providerSettingsSchema = z.object({
  model: z.string().trim().max(200).default(''),
  baseUrl: z.string().trim().max(500).default(''),
});

export const settingsSchema = z.object({
  provider: z.enum(PROVIDER_IDS as [ProviderId, ...ProviderId[]]).default('openai'),
  providers: z
    .record(z.string(), providerSettingsSchema)
    .default({})
    .transform((value) => value as Partial<Record<ProviderId, z.infer<typeof providerSettingsSchema>>>),
  temperature: z.number().min(0).max(2).default(0.2),
  maxOutputTokens: z.number().int().min(64).max(32_000).default(1200),
  /** Upper bound on page text sent per request (estimated tokens). */
  maxInputTokens: z.number().int().min(1000).max(200_000).default(12_000),
  keyStorage: z.enum(['session', 'persistent']).default('session'),
});

export type Settings = z.infer<typeof settingsSchema>;

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(KEY);
  const parsed = settingsSchema.safeParse(stored[KEY] ?? {});
  return parsed.success ? parsed.data : settingsSchema.parse({});
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [KEY]: settingsSchema.parse(settings) });
}

export function providerSettings(settings: Settings, id: ProviderId = settings.provider) {
  const saved = settings.providers[id];
  return {
    model: saved?.model || '',
    baseUrl: saved?.baseUrl || PROVIDERS[id].defaultBaseUrl,
  };
}
