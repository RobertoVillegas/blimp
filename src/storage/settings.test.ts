import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { activeProfile, loadSettings, newProfile } from './settings';

describe('settings', () => {
  beforeEach(() => fakeBrowser.reset());

  it('seeds one profile per base provider, OpenAI active', async () => {
    const settings = await loadSettings();
    expect(settings.profiles.map((profile) => profile.id)).toEqual([
      'openai',
      'anthropic',
      'gemini',
      'deepseek',
      'mistral',
      'opencode',
    ]);
    expect(activeProfile(settings).id).toBe('openai');
  });

  it('gives a second profile of the same provider its own id and name', async () => {
    const settings = await loadSettings();
    const second = newProfile('mistral', settings.profiles);
    expect(second.id).not.toBe('mistral');
    expect(second.name).toBe('Mistral AI 2');
  });

  it('migrates v0.1 per-provider settings, keeping the provider id so stored keys still match', async () => {
    await fakeBrowser.storage.local.set({
      settings: {
        provider: 'custom',
        providers: { custom: { model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com' }, openai: { model: 'gpt-x' } },
        temperature: 0.7,
      },
    });
    const settings = await loadSettings();
    expect(settings.activeProfileId).toBe('custom');
    expect(activeProfile(settings)).toMatchObject({ preset: 'custom', model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com' });
    expect(settings.profiles.find((profile) => profile.id === 'openai')?.model).toBe('gpt-x');
    expect(settings.temperature).toBe(0.7);
  });
});
