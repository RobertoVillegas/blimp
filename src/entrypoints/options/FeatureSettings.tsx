import { useEffect, useState } from 'react';
import type { UpdateStatus } from '@/shared/messages';
import { send } from '@/shared/send';
import { SEARCH_PROVIDERS, searchWeb } from '@/features/instant-links/adapters';
import { SEARCH_KEY_ID } from '@/features/instant-links';
import { originPattern } from '@/shared/url';
import { getApiKey, setApiKey } from '@/storage/secrets';
import type { Settings } from '@/storage/settings';

const ALL_SITES = ['http://*/*', 'https://*/*'];

type Notice = { tone: 'ok' | 'error' | 'info'; text: string } | undefined;

/** Opt-in features that need extra permissions: link previews, Instant Links search, Tidy Downloads. */
export function FeatureSettings({ settings, persist }: { settings: Settings; persist: (next: Settings) => Promise<void> }) {
  const [previewAccess, setPreviewAccess] = useState(true);
  const [searchProvider, setSearchProvider] = useState(settings.search.provider);
  const [searchBase, setSearchBase] = useState(settings.search.baseUrl);
  const [searchKey, setSearchKey] = useState('');
  const [hasSearchKey, setHasSearchKey] = useState(false);
  const [notices, setNotices] = useState<Record<'previews' | 'search' | 'downloads' | 'updates', Notice>>({
    previews: undefined,
    search: undefined,
    downloads: undefined,
    updates: undefined,
  });
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>();

  const note = (key: keyof typeof notices, value: Notice) => setNotices((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    void browser.permissions.contains({ origins: ALL_SITES }).then(setPreviewAccess);
    void getApiKey(SEARCH_KEY_ID).then((key) => setHasSearchKey(Boolean(key)));
    void send({ type: 'update/status' }).then(setUpdateStatus);
    if (location.hash === '#updates') requestAnimationFrame(() => document.getElementById('updates')?.scrollIntoView());
  }, []);

  async function checkNow() {
    note('updates', { tone: 'info', text: 'Checking GitHub…' });
    try {
      const status = await send({ type: 'update/check' });
      setUpdateStatus(status);
      note('updates', status.update ? undefined : { tone: 'ok', text: `You have the newest version (${status.current}).` });
    } catch (error) {
      note('updates', { tone: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  }

  async function setLinkPreviews(on: boolean) {
    if (on && !(await browser.permissions.request({ origins: ALL_SITES }))) {
      note('previews', { tone: 'error', text: 'Previews need access to websites. Nothing was changed.' });
      return;
    }
    setPreviewAccess(on || previewAccess);
    await persist({ ...settings, linkPreviews: on });
    note('previews', { tone: 'ok', text: on ? 'On. Hold Shift over a link on any page (reload pages that were already open).' : 'Off.' });
  }

  async function setTidyDownloads(on: boolean) {
    if (on && !(await browser.permissions.request({ permissions: ['downloads'] }))) {
      note('downloads', { tone: 'error', text: 'Tidy Downloads needs the downloads permission. Nothing was changed.' });
      return;
    }
    if (!on) await browser.permissions.remove({ permissions: ['downloads'] }).catch(() => false);
    await persist({ ...settings, tidyDownloads: on });
    note('downloads', { tone: 'ok', text: on ? 'On for new downloads.' : 'Off. Downloads keep the name the site gives them.' });
  }

  const searchBaseUrl = searchProvider === 'none' ? '' : searchBase || SEARCH_PROVIDERS[searchProvider].defaultBaseUrl;

  async function saveSearch(test: boolean) {
    if (searchProvider !== 'none') {
      const pattern = originPattern(searchBaseUrl);
      if (!pattern) {
        note('search', { tone: 'error', text: 'Enter the instance URL, starting with https://.' });
        return;
      }
      if (!(await browser.permissions.request({ origins: [pattern] }))) {
        note('search', { tone: 'error', text: `Helium Max needs access to ${pattern} to search.` });
        return;
      }
    }
    await persist({ ...settings, search: { provider: searchProvider, baseUrl: searchProvider === 'searxng' ? searchBase.trim() : '' } });
    if (searchKey.trim()) {
      await setApiKey(SEARCH_KEY_ID, searchKey.trim(), settings.keyStorage);
      setHasSearchKey(true);
      setSearchKey('');
    }
    if (!test || searchProvider === 'none') {
      note('search', { tone: 'ok', text: 'Saved.' });
      return;
    }
    note('search', { tone: 'info', text: 'Searching for “Helium browser”…' });
    try {
      const results = await searchWeb({
        provider: searchProvider,
        query: 'Helium browser',
        baseUrl: searchBaseUrl,
        apiKey: searchKey.trim() || (await getApiKey(SEARCH_KEY_ID)),
      });
      note('search', { tone: 'ok', text: `Saved. ${results.length} results, first: ${results[0]?.url ?? 'none'}` });
    } catch (error) {
      note('search', { tone: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <>
      <section aria-labelledby="tidy-heading">
        <h2 id="tidy-heading">Tidy Tabs</h2>
        <label className="inline">
          <input
            type="checkbox"
            checked={settings.tidyIntoExistingGroups}
            onChange={(event) => void persist({ ...settings, tidyIntoExistingGroups: event.target.checked })}
          />
          Also add tabs to groups I already have
        </label>
        <p className="hint">
          Off: Tidy Tabs only makes new groups and leaves yours alone. On: a new PHP tab can join your existing "PHP"
          group instead of starting another one. Your groups keep their names and colors, and Undo takes the added tabs
          back out.
        </p>
      </section>

      <section aria-labelledby="previews-heading">
        <h2 id="previews-heading">Link previews</h2>
        <label className="inline">
          <input type="checkbox" checked={settings.linkPreviews} onChange={(event) => void setLinkPreviews(event.target.checked)} />
          Preview a link when I hold Shift over it
        </label>
        <p className="hint">
          Helium Max downloads the linked page without your cookies, so signed-in pages show as unavailable, and sends
          its text to the active AI profile. Hovering without Shift sends nothing. This needs access to all websites, so
          the Shift detector can run on the pages you visit.
        </p>
        {settings.linkPreviews && !previewAccess && (
          <p className="warning">
            Site access was removed, so previews are paused.{' '}
            <button onClick={() => void setLinkPreviews(true)}>Allow again</button>
          </p>
        )}
        <Status notice={notices.previews} />
      </section>

      <section aria-labelledby="search-heading">
        <h2 id="search-heading">Instant Links search</h2>
        <p className="hint">
          Instant Links opens results from a real search engine; the AI only picks the best one. Without a provider it
          hands your query to the browser's normal search.
        </p>
        <label>
          Search provider
          <select value={searchProvider} onChange={(event) => setSearchProvider(event.target.value as typeof searchProvider)}>
            <option value="none">None (use the browser's search engine)</option>
            <option value="brave">{SEARCH_PROVIDERS.brave.label}</option>
            <option value="searxng">{SEARCH_PROVIDERS.searxng.label} (self-hosted)</option>
          </select>
        </label>
        {searchProvider === 'brave' && (
          <label>
            Brave Search API key
            <input
              type="password"
              value={searchKey}
              onChange={(event) => setSearchKey(event.target.value)}
              placeholder={hasSearchKey ? 'A key is stored; type to replace it' : 'Paste your key'}
              autoComplete="off"
            />
            <a href={SEARCH_PROVIDERS.brave.keyUrl} target="_blank" rel="noreferrer">
              Get a Brave Search API key
            </a>
          </label>
        )}
        {searchProvider === 'searxng' && (
          <label>
            Instance URL
            <input
              value={searchBase}
              onChange={(event) => setSearchBase(event.target.value)}
              placeholder="https://searx.example.org"
              spellCheck={false}
            />
            <span className="hint">The instance must allow the JSON format (search.formats in settings.yml).</span>
          </label>
        )}
        <div className="actions">
          <button onClick={() => void saveSearch(false)}>Save</button>
          {searchProvider !== 'none' && <button onClick={() => void saveSearch(true)}>Save and test</button>}
        </div>
        <Status notice={notices.search} />
      </section>

      <section aria-labelledby="downloads-heading">
        <h2 id="downloads-heading">Tidy Downloads</h2>
        <label className="inline">
          <input type="checkbox" checked={settings.tidyDownloads} onChange={(event) => void setTidyDownloads(event.target.checked)} />
          Suggest clearer names for files I download
        </label>
        <p className="hint">
          Before each download is saved, the active AI profile gets its filename, file type, the address it came from
          (without query strings) and the page title. File contents are never read. The extension stays the same, and if
          the AI takes more than 4 seconds the original name is used. Files already saved are never renamed.
        </p>
        <Status notice={notices.downloads} />
      </section>

      <section id="updates" aria-labelledby="updates-heading">
        <h2 id="updates-heading">Updates</h2>
        <p className="hint">
          You're on version {updateStatus?.current ?? '…'}. Extensions loaded from a folder can't update themselves, so
          Helium Max tells you when a new release is out.
        </p>
        {updateStatus?.autoUpdated && (
          <p className="notice ok">
            Updated from {updateStatus.autoUpdated.from} to {updateStatus.autoUpdated.to} on{' '}
            {new Date(updateStatus.autoUpdated.at).toLocaleString()}.
          </p>
        )}
        {updateStatus?.update && (
          <div className="update-banner" role="status">
            <strong>Version {updateStatus.update.version} is available. We recommend updating.</strong>
            <ol>
              <li>
                <a href={updateStatus.update.downloadUrl}>Download helium-max-{updateStatus.update.version}-chrome.zip</a>{' '}
                (<a href={updateStatus.update.pageUrl} target="_blank" rel="noreferrer">what's new</a>).
              </li>
              <li>Unzip it and copy everything into the folder you loaded, replacing the old files.</li>
              <li>
                Helium Max reloads itself within a minute, or{' '}
                <button onClick={() => browser.runtime.reload()}>reload it now</button>. Profiles and settings stay;
                keys kept only for the session need to be entered again.
              </li>
            </ol>
          </div>
        )}
        <label className="inline">
          <input
            type="checkbox"
            checked={settings.updateChecks}
            onChange={(event) => void persist({ ...settings, updateChecks: event.target.checked })}
          />
          Tell me when a new version is out (checks GitHub twice a day)
        </label>
        <p className="hint">The check asks GitHub's public API for this project's releases. Nothing about you or your browsing is sent.</p>
        <div className="actions">
          <button onClick={() => void checkNow()}>Check now</button>
          <button onClick={() => browser.runtime.reload()}>Reload Helium Max</button>
        </div>
        <Status notice={notices.updates} />
      </section>
    </>
  );
}

function Status({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p className={`notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      {notice.text}
    </p>
  );
}
