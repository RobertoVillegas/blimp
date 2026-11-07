import { useEffect, useId, useState } from 'react';
import { profileConfig } from '@/ai/active';
import { complete, listModels } from '@/ai/client';
import { PRESET_IDS, PRESETS, isHostedEndpoint } from '@/ai/presets';
import type { PresetId } from '@/shared/types';
import { originPattern } from '@/shared/url';
import { clearAllSecrets, clearApiKey, getApiKey, setApiKey } from '@/storage/secrets';
import {
  loadSettings,
  newProfile,
  profileBaseUrl,
  saveSettings,
  type Profile,
  type Settings,
} from '@/storage/settings';

type Notice = { tone: 'ok' | 'error' | 'info'; text: string };

export function App() {
  const [settings, setSettings] = useState<Settings>();
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<Profile>();
  const [apiKey, setApiKeyValue] = useState('');
  const [storedKeys, setStoredKeys] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<string[]>([]);
  const [addPreset, setAddPreset] = useState<PresetId>('custom');
  const [notice, setNotice] = useState<Notice>();
  const [busy, setBusy] = useState(false);
  const [shortcuts, setShortcuts] = useState<Browser.commands.Command[]>([]);
  const modelListId = useId();

  useEffect(() => {
    void loadSettings().then(async (loaded) => {
      setSettings(loaded);
      select(loaded, loaded.activeProfileId);
      const entries = await Promise.all(
        loaded.profiles.map(async (profile) => [profile.id, Boolean(await getApiKey(profile.id))] as const),
      );
      setStoredKeys(Object.fromEntries(entries));
    });
    void browser.commands.getAll().then(setShortcuts);
  }, []);

  if (!settings || !draft) return null;
  const preset = PRESETS[draft.preset];
  const baseUrl = profileBaseUrl(draft);
  const hosted = isHostedEndpoint(draft.preset, baseUrl);
  const isActive = draft.id === settings.activeProfileId;

  function select(current: Settings, id: string) {
    const profile = current.profiles.find((candidate) => candidate.id === id) ?? current.profiles[0]!;
    setSelectedId(profile.id);
    setDraft({ ...profile });
    setApiKeyValue('');
    setModels([]);
    setNotice(undefined);
  }

  async function persist(next: Settings) {
    await saveSettings(next);
    setSettings(next);
  }

  function withDraft(current: Settings): Settings {
    return {
      ...current,
      profiles: current.profiles.map((profile) => (profile.id === draft!.id ? { ...draft!, name: draft!.name.trim() || preset.label } : profile)),
    };
  }

  /** Must run first in a click handler: permission prompts need the user gesture. */
  async function requestOrigin(): Promise<boolean> {
    const pattern = originPattern(baseUrl);
    if (!pattern) {
      setNotice({ tone: 'error', text: 'The base URL must start with http:// or https://.' });
      return false;
    }
    const granted = await browser.permissions.request({ origins: [pattern] });
    if (!granted) setNotice({ tone: 'error', text: `Helium Max needs access to ${pattern} to call this provider.` });
    return granted;
  }

  async function currentKey() {
    return apiKey.trim() || (await getApiKey(draft!.id));
  }

  async function save(makeActive = false) {
    if (!(await requestOrigin())) return;
    const next = withDraft(settings!);
    if (makeActive) next.activeProfileId = draft!.id;
    await persist(next);
    if (apiKey.trim()) {
      await setApiKey(draft!.id, apiKey.trim(), next.keyStorage);
      setStoredKeys({ ...storedKeys, [draft!.id]: true });
      setApiKeyValue('');
    }
    setNotice({ tone: 'ok', text: makeActive ? `Saved. ${draft!.name} is now the active profile.` : 'Saved.' });
  }

  async function testConnection() {
    if (!(await requestOrigin())) return;
    setBusy(true);
    setNotice({ tone: 'info', text: `Contacting ${draft!.name}…` });
    try {
      const reply = await complete(
        profileConfig(draft!, await currentKey()),
        { system: 'You are a connection test.', messages: [{ role: 'user', content: 'Reply with the word OK.' }], maxOutputTokens: 64 },
        { timeoutMs: 30_000 },
      );
      setNotice({ tone: 'ok', text: `Connected. ${draft!.model} replied: “${reply.trim().slice(0, 60)}”` });
    } catch (error) {
      setNotice({ tone: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function loadModels() {
    if (!(await requestOrigin())) return;
    setBusy(true);
    try {
      const ids = await listModels(profileConfig(draft!, await currentKey()));
      setModels(ids);
      setNotice(
        ids.length
          ? { tone: 'ok', text: `${ids.length} models available. Pick one in the Model ID field.` }
          : { tone: 'info', text: 'The endpoint returned no models; type the model ID yourself.' },
      );
    } catch (error) {
      setNotice({ tone: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function addProfile() {
    const profile = newProfile(addPreset, settings!.profiles);
    const next = { ...settings!, profiles: [...settings!.profiles, profile] };
    await persist(next);
    select(next, profile.id);
  }

  async function deleteProfile() {
    const remaining = settings!.profiles.filter((profile) => profile.id !== draft!.id);
    const next = {
      ...settings!,
      profiles: remaining,
      activeProfileId: isActive ? remaining[0]!.id : settings!.activeProfileId,
    };
    await clearApiKey(draft!.id);
    await persist(next);
    select(next, next.activeProfileId);
  }

  async function clearEverything() {
    await clearAllSecrets();
    await browser.storage.session.clear();
    setStoredKeys({});
    setNotice({ tone: 'ok', text: 'API keys, page conversations and the Tidy Tabs undo history were cleared.' });
  }

  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });
  const edit = (patch: Partial<Profile>) => setDraft({ ...draft, ...patch });
  const paletteShortcut = shortcuts.find((command) => command.name === 'open-palette')?.shortcut;
  const fallbackShortcut = shortcuts.find((command) => command.name === 'open-palette-fallback')?.shortcut;

  return (
    <main>
      <h1>Helium Max</h1>
      <p className="lead">
        Bring your own AI provider. Helium Max has no server, account or telemetry: requests go straight from your
        browser to the provider of the active profile.
      </p>

      <section aria-labelledby="profiles-heading">
        <h2 id="profiles-heading">AI profiles</h2>
        <p className="hint">
          Each profile has its own provider, model and key. The active one is used by every command; switch from the
          palette by typing “profile”.
        </p>
        <ul className="profiles" role="listbox" aria-label="Profiles">
          {settings.profiles.map((profile) => (
            <li
              key={profile.id}
              role="option"
              aria-selected={profile.id === selectedId}
              tabIndex={0}
              onClick={() => select(settings, profile.id)}
              onKeyDown={(event) => event.key === 'Enter' && select(settings, profile.id)}
            >
              <span className="profile-name">
                {profile.name}
                {profile.id === settings.activeProfileId && <span className="badge">Active</span>}
              </span>
              <span className="profile-meta">
                {profile.model || 'no model'} · {PRESETS[profile.preset].needsKey && !storedKeys[profile.id] ? 'no key' : 'ready'}
              </span>
            </li>
          ))}
        </ul>
        <div className="actions">
          <select value={addPreset} onChange={(event) => setAddPreset(event.target.value as PresetId)} aria-label="Provider for the new profile">
            {PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {PRESETS[id].label}
              </option>
            ))}
          </select>
          <button onClick={() => void addProfile()}>Add profile</button>
        </div>
      </section>

      <section aria-labelledby="edit-heading">
        <h2 id="edit-heading">
          {draft.name} <span className="hint">({preset.label})</span>
        </h2>

        <label>
          Name
          <input value={draft.name} onChange={(event) => edit({ name: event.target.value })} />
        </label>

        {preset.editableBaseUrl && (
          <label>
            Base URL
            <input
              value={draft.baseUrl}
              onChange={(event) => edit({ baseUrl: event.target.value })}
              placeholder={preset.defaultBaseUrl || 'https://example.com/v1'}
              spellCheck={false}
            />
          </label>
        )}

        {(preset.needsKey || draft.preset === 'custom') && (
          <label>
            API key{!preset.needsKey && ' (optional)'}
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKeyValue(event.target.value)}
              placeholder={storedKeys[draft.id] ? 'A key is stored; type to replace it' : 'Paste your key'}
              autoComplete="off"
              spellCheck={false}
            />
            {preset.keyUrl && (
              <a href={preset.keyUrl} target="_blank" rel="noreferrer">
                Get an API key from {preset.label}
              </a>
            )}
          </label>
        )}

        <label>
          Model ID
          <span className="row">
            <input
              value={draft.model}
              onChange={(event) => edit({ model: event.target.value })}
              placeholder={preset.modelPlaceholder}
              list={modelListId}
              spellCheck={false}
            />
            <button type="button" onClick={() => void loadModels()} disabled={busy}>
              Load models
            </button>
          </span>
          <datalist id={modelListId}>
            {models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>

        {preset.note && <p className="hint">{preset.note}</p>}

        <p className="disclosure">
          {hosted
            ? `When you run a command, this provider receives what that command needs: tab titles and URLs for Tidy Tabs, page text for Summarize/Ask Page. Nothing is sent while you just browse.`
            : 'This endpoint runs on your machine; page text does not leave it.'}
        </p>

        <div className="actions">
          <button onClick={() => void save()}>Save</button>
          {!isActive && <button onClick={() => void save(true)}>Save and use</button>}
          <button onClick={() => void testConnection()} disabled={busy}>
            Test connection
          </button>
          {settings.profiles.length > 1 && (
            <button className="danger" onClick={() => void deleteProfile()}>
              Delete profile
            </button>
          )}
        </div>
        {notice && (
          <p className={`notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            {notice.text}
          </p>
        )}
      </section>

      <section aria-labelledby="keys-heading">
        <h2 id="keys-heading">API keys</h2>
        <fieldset>
          <legend>Keep API keys</legend>
          <label className="inline">
            <input type="radio" checked={settings.keyStorage === 'session'} onChange={() => void persist({ ...settings, keyStorage: 'session' })} />
            Until the browser quits (recommended)
          </label>
          <label className="inline">
            <input
              type="radio"
              checked={settings.keyStorage === 'persistent'}
              onChange={() => void persist({ ...settings, keyStorage: 'persistent' })}
            />
            On this device across restarts
          </label>
          {settings.keyStorage === 'persistent' && (
            <p className="warning">
              Keys you save from now on are stored unencrypted in this extension's local database. Webpages and content
              scripts cannot read them, but anyone with access to your browser profile on disk can.
            </p>
          )}
        </fieldset>
      </section>

      <section aria-labelledby="limits-heading">
        <h2 id="limits-heading">Limits</h2>
        <label>
          Temperature
          <input type="number" min={0} max={2} step={0.1} value={settings.temperature} onChange={(event) => update({ temperature: Number(event.target.value) })} />
        </label>
        <label>
          Max answer length (tokens)
          <input
            type="number"
            min={64}
            max={32000}
            step={100}
            value={settings.maxOutputTokens}
            onChange={(event) => update({ maxOutputTokens: Number(event.target.value) })}
          />
        </label>
        <label>
          Max page text sent per request (≈tokens)
          <input
            type="number"
            min={1000}
            max={200000}
            step={1000}
            value={settings.maxInputTokens}
            onChange={(event) => update({ maxInputTokens: Number(event.target.value) })}
          />
        </label>
        <button
          onClick={() =>
            void persist(settings).then(() => setNotice({ tone: 'ok', text: 'Limits saved.' }))
          }
        >
          Save limits
        </button>
      </section>

      <section aria-labelledby="shortcuts-heading">
        <h2 id="shortcuts-heading">Keyboard shortcuts</h2>
        <p>
          Palette: <kbd>{paletteShortcut || 'not set'}</kbd> · Fallback: <kbd>{fallbackShortcut || 'not set'}</kbd>
        </p>
        {!paletteShortcut && (
          <p className="warning">
            The browser did not grant ⌘K (another shortcut owns it). Use the fallback or the toolbar button, or assign a
            shortcut yourself.
          </p>
        )}
        <button onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}>Change shortcuts</button>
      </section>

      <section aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Privacy</h2>
        <ul>
          <li>Tidy Tabs only runs when you ask. It names groups, never individual tabs, and never closes tabs.</li>
          <li>Page text is read only when you run Summarize or Ask Page, and only from the page you're on.</li>
          <li>Conversations and the undo snapshot live in memory for this browser session and are not saved to disk.</li>
          <li>Helium Max asks for site access only for the providers you configure.</li>
        </ul>
        <button className="danger" onClick={() => void clearEverything()}>
          Clear credentials and cache
        </button>
      </section>
    </main>
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
