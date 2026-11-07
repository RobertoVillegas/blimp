import { useEffect, useState } from 'react';
import type { UpdateStatus } from '@/shared/messages';
import { send } from '@/shared/send';
import { SEARCH_PROVIDERS, searchWeb } from '@/features/instant-links/adapters';
import { SEARCH_KEY_ID } from '@/features/instant-links';
import { CALENDAR_SECRET_ID } from '@/features/peeks';
import { GMAIL_ORIGIN } from '@/features/peeks/gmail';
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
  const [notices, setNotices] = useState<Record<'previews' | 'search' | 'downloads' | 'updates' | 'video' | 'peeks', Notice>>({
    video: undefined,
    peeks: undefined,
    previews: undefined,
    search: undefined,
    downloads: undefined,
    updates: undefined,
  });
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>();
  const [calendarUrl, setCalendarUrl] = useState('');
  const [hasCalendar, setHasCalendar] = useState(false);

  const note = (key: keyof typeof notices, value: Notice) => setNotices((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    void browser.permissions.contains({ origins: ALL_SITES }).then(setPreviewAccess);
    void getApiKey(SEARCH_KEY_ID).then((key) => setHasSearchKey(Boolean(key)));
    void send({ type: 'update/status' }).then(setUpdateStatus);
    void getApiKey(CALENDAR_SECRET_ID).then((url) => setHasCalendar(Boolean(url)));
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

  async function setAutoFloat(on: boolean) {
    if (on && !(await browser.permissions.request({ origins: ALL_SITES }))) {
      note('video', { tone: 'error', text: 'Floating videos automatically needs access to websites. Nothing was changed.' });
      return;
    }
    await persist({ ...settings, autoFloat: on });
    note('video', {
      tone: 'ok',
      text: on ? 'On. Reload pages that were already open. The browser may ask once per site to allow automatic picture in picture.' : 'Off.',
    });
  }

  async function setGmailPeek(on: boolean) {
    if (on && !(await browser.permissions.request({ origins: [GMAIL_ORIGIN] }))) {
      note('peeks', { tone: 'error', text: 'Gmail peeks need access to mail.google.com. Nothing was changed.' });
      return;
    }
    await persist({ ...settings, peeks: { ...settings.peeks, gmail: on } });
    note('peeks', { tone: 'ok', text: on ? 'Gmail is on. Try Unread Email in the palette.' : 'Gmail is off.' });
  }

  async function saveCalendar() {
    const url = calendarUrl.trim();
    if (!url) {
      await setApiKey(CALENDAR_SECRET_ID, '', settings.keyStorage);
      setHasCalendar(false);
      note('peeks', { tone: 'ok', text: 'Calendar address removed.' });
      return;
    }
    const pattern = originPattern(url);
    if (!pattern || !url.startsWith('https://')) {
      note('peeks', { tone: 'error', text: 'Paste the https address that ends in .ics.' });
      return;
    }
    if (!(await browser.permissions.request({ origins: [pattern] }))) {
      note('peeks', { tone: 'error', text: `Helium Max needs access to ${pattern} to read the calendar.` });
      return;
    }
    await setApiKey(CALENDAR_SECRET_ID, url, settings.keyStorage);
    setHasCalendar(true);
    setCalendarUrl('');
    try {
      const events = await send({ type: 'peek/calendar' });
      note('peeks', { tone: 'ok', text: `Saved. ${events.length} events in the next two days.` });
    } catch (error) {
      note('peeks', { tone: 'error', text: error instanceof Error ? error.message : String(error) });
    }
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
        <label className="inline">
          <input
            type="checkbox"
            checked={settings.previewListLinks}
            disabled={!settings.linkPreviews}
            onChange={(event) => void persist({ ...settings, previewListLinks: event.target.checked })}
          />
          Also preview without Shift on Hacker News, Google results, Reddit, X, GitHub and Lobsters
        </label>
        <p className="hint">
          Like Arc: rest the pointer on a story or result link for about a second. Only those main links, not every link on
          the page.
        </p>
        {settings.linkPreviews && !previewAccess && (
          <p className="warning">
            Site access was removed, so previews are paused.{' '}
            <button onClick={() => void setLinkPreviews(true)}>Allow again</button>
          </p>
        )}
        <Status notice={notices.previews} />
      </section>

      <section aria-labelledby="peeks-heading">
        <h2 id="peeks-heading">Peeks</h2>
        <p className="hint">
          Glance at your inbox and calendar from the palette (Unread Email, Upcoming Events), the way Arc showed them when you
          hovered a favorite. Nothing from them is sent to an AI.
        </p>
        <label className="inline">
          <input type="checkbox" checked={settings.peeks.gmail} onChange={(event) => void setGmailPeek(event.target.checked)} />
          Gmail: show my unread email
        </label>
        <p className="hint">Uses the Gmail account you're signed in to in this browser (the one in your open Gmail tab, if any).</p>
        <label>
          Google Calendar: secret address in iCal format
          <span className="row">
            <input
              type="password"
              value={calendarUrl}
              onChange={(event) => setCalendarUrl(event.target.value)}
              placeholder={hasCalendar ? 'An address is saved; paste to replace, or leave empty and save to remove' : 'https://calendar.google.com/calendar/ical/…/basic.ics'}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" onClick={() => void saveCalendar()}>
              Save
            </button>
          </span>
          <span className="hint">
            In Google Calendar: Settings › your calendar › Integrate calendar › Secret address in iCal format. Treat it like a
            password; it's kept the same way as your API keys.
          </span>
        </label>
        <Status notice={notices.peeks} />
      </section>

      <section aria-labelledby="video-heading">
        <h2 id="video-heading">Video</h2>
        <label className="inline">
          <input type="checkbox" checked={settings.autoFloat} onChange={(event) => void setAutoFloat(event.target.checked)} />
          Float a playing video when I switch to another tab (experimental)
        </label>
        <p className="hint">
          Like Arc: leave a tab while its video plays and it keeps playing in a small window you can move anywhere; come back
          and it returns. The browser does the floating and may ask once per site. Nothing is sent anywhere. For a video
          you want to float right now, use Picture in Picture in the palette.
        </p>
        <Status notice={notices.video} />
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
