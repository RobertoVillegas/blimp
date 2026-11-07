import { useEffect, useState } from 'react';
import { PROVIDER_IDS, PROVIDERS, isHostedEndpoint } from '@/ai/catalog';
import { complete } from '@/ai/client';
import type { ProviderId } from '@/shared/types';
import { originPattern } from '@/shared/url';
import { clearAllSecrets, getApiKey, setApiKey } from '@/storage/secrets';
import { loadSettings, providerSettings, saveSettings, type Settings } from '@/storage/settings';

type Notice = { tone: 'ok' | 'error' | 'info'; text: string };

export function App() {
  const [settings, setSettings] = useState<Settings>();
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKeyValue] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [busy, setBusy] = useState(false);
  const [shortcuts, setShortcuts] = useState<Browser.commands.Command[]>([]);

  useEffect(() => {
    void loadSettings().then((loaded) => {
      setSettings(loaded);
      void selectProvider(loaded, loaded.provider);
    });
    void browser.commands.getAll().then(setShortcuts);
  }, []);

  if (!settings) return null;
  const provider = settings.provider;
  const info = PROVIDERS[provider];
  const hosted = isHostedEndpoint(provider, baseUrl || info.defaultBaseUrl);

  async function selectProvider(current: Settings, id: ProviderId) {
    const next = { ...current, provider: id };
    const saved = providerSettings(next, id);
    setSettings(next);
    setModel(saved.model);
    setBaseUrl(saved.baseUrl);
    setApiKeyValue('');
    setHasStoredKey(Boolean(await getApiKey(id)));
    setNotice(undefined);
  }

  function formSettings(): Settings {
    return {
      ...settings!,
      providers: { ...settings!.providers, [provider]: { model: model.trim(), baseUrl: baseUrl.trim() } },
    };
  }

  /** Must run first in a click handler: permission prompts need the user gesture. */
  async function requestOrigin(): Promise<boolean> {
    const pattern = originPattern(baseUrl || info.defaultBaseUrl);
    if (!pattern) {
      setNotice({ tone: 'error', text: 'The base URL must start with http:// or https://.' });
      return false;
    }
    const granted = await browser.permissions.request({ origins: [pattern] });
    if (!granted) {
      setNotice({ tone: 'error', text: `Helium Max needs access to ${pattern} to call this provider.` });
    }
    return granted;
  }

  async function save() {
    if (!(await requestOrigin())) return;
    const next = formSettings();
    await saveSettings(next);
    if (apiKey) await setApiKey(provider, apiKey.trim(), next.keyStorage);
    setSettings(next);
    setHasStoredKey(Boolean(apiKey) || hasStoredKey);
    setApiKeyValue('');
    setNotice({ tone: 'ok', text: 'Saved.' });
  }

  async function testConnection() {
    if (!(await requestOrigin())) return;
    setBusy(true);
    setNotice({ tone: 'info', text: `Contacting ${info.label}…` });
    try {
      const key = apiKey.trim() || (await getApiKey(provider));
      const reply = await complete(
        { id: provider, model: model.trim(), baseUrl: (baseUrl || info.defaultBaseUrl).trim(), apiKey: key },
        { system: 'You are a connection test.', messages: [{ role: 'user', content: 'Reply with the word OK.' }], maxOutputTokens: 64 },
        { timeoutMs: 30_000 },
      );
      setNotice({ tone: 'ok', text: `Connected. ${info.label} replied: “${reply.trim().slice(0, 60)}”` });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function clearEverything() {
    await clearAllSecrets();
    await browser.storage.session.clear();
    setHasStoredKey(false);
    setNotice({ tone: 'ok', text: 'API keys, page conversations and the Tidy Tabs undo history were cleared.' });
  }

  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });
  const paletteShortcut = shortcuts.find((command) => command.name === 'open-palette')?.shortcut;
  const fallbackShortcut = shortcuts.find((command) => command.name === 'open-palette-fallback')?.shortcut;

  return (
    <main>
      <h1>Helium Max</h1>
      <p className="lead">
        Bring your own AI provider. Helium Max has no server, account or telemetry: requests go straight
        from your browser to the provider you pick here.
      </p>

      <section aria-labelledby="provider-heading">
        <h2 id="provider-heading">AI provider</h2>
        <label>
          Provider
          <select value={provider} onChange={(event) => void selectProvider(settings, event.target.value as ProviderId)}>
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {PROVIDERS[id].label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Model ID
          <input value={model} onChange={(event) => setModel(event.target.value)} placeholder={info.modelPlaceholder} spellCheck={false} />
        </label>

        {info.editableBaseUrl && (
          <label>
            Base URL
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={info.defaultBaseUrl || 'https://example.com/v1'}
              spellCheck={false}
            />
          </label>
        )}

        {(info.needsKey || provider === 'custom') && (
          <label>
            API key{provider === 'custom' && ' (optional)'}
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKeyValue(event.target.value)}
              placeholder={hasStoredKey ? 'A key is stored; type to replace it' : 'Paste your key'}
              autoComplete="off"
              spellCheck={false}
            />
            {info.keyUrl && (
              <a href={info.keyUrl} target="_blank" rel="noreferrer">
                Get a {info.label} key
              </a>
            )}
          </label>
        )}

        <fieldset>
          <legend>Keep API keys</legend>
          <label className="inline">
            <input
              type="radio"
              checked={settings.keyStorage === 'session'}
              onChange={() => update({ keyStorage: 'session' })}
            />
            Until the browser quits (recommended)
          </label>
          <label className="inline">
            <input
              type="radio"
              checked={settings.keyStorage === 'persistent'}
              onChange={() => update({ keyStorage: 'persistent' })}
            />
            On this device across restarts
          </label>
          {settings.keyStorage === 'persistent' && (
            <p className="warning">
              Saved keys are stored unencrypted in this extension's local database. Webpages and content scripts cannot
              read them, but anyone with access to your browser profile on disk can.
            </p>
          )}
        </fieldset>

        <p className={hosted ? 'disclosure' : 'disclosure local'}>
          {hosted
            ? `When you run a command, ${info.label} receives what that command needs: tab titles and URLs for Tidy Tabs, page text for Summarize/Ask Page. Nothing is sent while you just browse.`
            : 'This endpoint runs on your machine; page text does not leave it.'}
          {provider === 'ollama' &&
            ' Ollama must allow extension origins: start it with OLLAMA_ORIGINS="chrome-extension://*".'}
        </p>

        <div className="actions">
          <button onClick={() => void save()}>Save</button>
          <button onClick={() => void testConnection()} disabled={busy}>
            Test connection
          </button>
        </div>
        {notice && (
          <p className={`notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            {notice.text}
          </p>
        )}
      </section>

      <section aria-labelledby="limits-heading">
        <h2 id="limits-heading">Limits</h2>
        <label>
          Temperature
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={settings.temperature}
            onChange={(event) => update({ temperature: Number(event.target.value) })}
          />
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
        <p className="hint">Limits are saved with the Save button above.</p>
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
        <button onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}>
          Change shortcuts
        </button>
      </section>

      <section aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Privacy</h2>
        <ul>
          <li>Tidy Tabs only runs when you ask. It names groups, never individual tabs, and never closes tabs.</li>
          <li>Page text is read only when you run Summarize or Ask Page, and only from the page you're on.</li>
          <li>Conversations and the undo snapshot live in memory for this browser session and are not saved to disk.</li>
          <li>Helium Max asks for site access only for the provider you configure.</li>
        </ul>
        <button className="danger" onClick={() => void clearEverything()}>
          Clear credentials and cache
        </button>
      </section>
    </main>
  );
}
