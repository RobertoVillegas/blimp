import { useCallback, useEffect, useRef, useState } from 'react';
import { send } from '@/shared/send';
import type { ArchivedTab, LiveFolderView, NowPlaying } from '@/shared/types';
import { PeekCard, peekKind, type PeekKind } from './PeekCard';
import { moveTab, type DropTarget } from './tab-moves';

type Tab = Browser.tabs.Tab;
type Group = Browser.tabGroups.TabGroup;

const NO_GROUP = -1;
const DRAG_TYPE = 'application/x-blimp-tab';

/** Arc's sidebar for Helium: Favorites, folders, Today, the mini player and Live Folders, in one column. */
export function Sidebar() {
  const windowId = useWindowId();
  const { tabs, groups } = useWindowTabs(windowId);
  const media = useMedia();
  const [live, setLive] = useState<LiveFolderView[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    const load = () => void send({ type: 'live/list' }).then(setLive).catch(() => undefined);
    load();
    const timer = setInterval(load, 5 * 60_000);
    return () => clearInterval(timer);
  }, []);

  const active = tabs.find((tab) => tab.active);
  const favorites = tabs.filter((tab) => tab.pinned);
  const today = tabs.filter((tab) => !tab.pinned && tab.groupId === NO_GROUP);

  const fail = (error: unknown) => setNotice(error instanceof Error ? error.message : String(error));

  async function clearToday() {
    if (today.length === 0) return;
    const count = await send({ type: 'archive/tabs', tabIds: today.map((tab) => tab.id!) }).catch(fail);
    if (count) setNotice(`Archived ${count === 1 ? '1 tab' : `${count} tabs`}. Reopen them from Archive below.`);
  }

  async function tidy() {
    setNotice('Tidying tabs…');
    try {
      const result = await send({ type: 'tidy/run', opId: crypto.randomUUID(), windowId });
      setNotice(result.groups.length ? `Made ${result.groups.length === 1 ? '1 folder' : `${result.groups.length} folders`}.` : 'Nothing to tidy.');
    } catch (error) {
      fail(error);
    }
  }

  return (
    <div className="sb">
      <TopBar active={active} windowId={windowId} />

      <Favorites tabs={favorites} />

      <div className="sb-scroll">
        {groups.map((group) => (
          <Folder key={group.id} group={group} tabs={tabs.filter((tab) => !tab.pinned && tab.groupId === group.id)} />
        ))}

        <section className="sb-section" aria-label="Today">
          <div className="sb-today-head">
            <DropZone target={{ section: 'today' }} className="sb-label">
              Today
            </DropZone>
            <button className="sb-text-button" onClick={() => void tidy()} title="Group these tabs into folders with your AI">
              Tidy
            </button>
            <button className="sb-text-button" onClick={() => void clearToday()} disabled={today.length === 0} title="Archive every tab in Today">
              Clear
            </button>
          </div>
          <button className="sb-row sb-new-tab" onClick={() => void browser.tabs.create({ windowId })}>
            <span className="sb-icon" aria-hidden="true">
              +
            </span>
            <span className="sb-title">New Tab</span>
          </button>
          <TabList tabs={today} target={{ section: 'today' }} label="Today's tabs" />
        </section>

        {live.length > 0 && <LiveFolders folders={live} onChange={setLive} />}

        {archiveOpen && <Archive onClose={() => setArchiveOpen(false)} windowId={windowId} />}
      </div>

      {notice && (
        <p className="sb-notice" role="status" onClick={() => setNotice(undefined)}>
          {notice}
        </p>
      )}

      {media.length > 0 && <MiniPlayer items={media} />}

      <footer className="sb-footer">
        <button onClick={() => setArchiveOpen((open) => !open)} aria-pressed={archiveOpen}>
          Archive
        </button>
        <button onClick={() => void send({ type: 'little/open' })} title="Open a small window for a quick lookup (⌥⇧N)">
          Little Blimp
        </button>
        <button onClick={() => void send({ type: 'settings/open' })}>Settings</button>
      </footer>
    </div>
  );
}

function TopBar({ active, windowId }: { active?: Tab; windowId?: number }) {
  const host = active?.url ? hostOf(active.url) : '';
  return (
    <header className="sb-top">
      <nav className="sb-nav" aria-label="Navigation">
        <button aria-label="Back" title="Back" onClick={() => active?.id && void browser.tabs.goBack(active.id).catch(() => undefined)}>
          ←
        </button>
        <button aria-label="Forward" title="Forward" onClick={() => active?.id && void browser.tabs.goForward(active.id).catch(() => undefined)}>
          →
        </button>
        <button aria-label="Reload" title="Reload" onClick={() => active?.id && void browser.tabs.reload(active.id)}>
          ↻
        </button>
      </nav>
      <button className="sb-address" onClick={() => void send({ type: 'palette/open', windowId })} title="Search or run a command (⌘K)">
        {host || 'Search or enter a command'}
      </button>
    </header>
  );
}

/** Pinned tabs as Arc's favorites grid. Hovering Gmail or Calendar shows what's new without opening it. */
function Favorites({ tabs }: { tabs: Tab[] }) {
  const [peek, setPeek] = useState<{ kind: PeekKind; tabId: number }>();
  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const enter = (tab: Tab) => {
    clearTimeout(hideTimer.current);
    const kind = peekKind(tab.url);
    clearTimeout(showTimer.current);
    if (!kind) return;
    showTimer.current = setTimeout(() => setPeek({ kind, tabId: tab.id! }), peek ? 0 : 350);
  };
  const leave = () => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setPeek(undefined), 250);
  };
  const keep = () => clearTimeout(hideTimer.current);

  return (
    <DropZone target={{ section: 'favorites' }} className="sb-favorites-wrap">
      {tabs.length === 0 ? (
        <p className="sb-hint">Drag a tab here, or pin it, to make it a favorite.</p>
      ) : (
        <ul className="sb-favorites" aria-label="Favorites">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                className={`sb-favorite${tab.active ? ' active' : ''}${tab.audible ? ' audible' : ''}`}
                title={tab.title}
                aria-label={tab.title}
                draggable
                onDragStart={(event) => startDrag(event, tab)}
                onDragOver={allowDrop}
                onDrop={(event) => void drop(event, { section: 'favorites' }, tab.id)}
                onClick={() => void browser.tabs.update(tab.id!, { active: true })}
                onMouseEnter={() => enter(tab)}
                onMouseLeave={leave}
                onFocus={() => enter(tab)}
                onBlur={leave}
              >
                <Favicon tab={tab} size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {peek && <PeekCard kind={peek.kind} tabId={peek.tabId} onMouseEnter={keep} onMouseLeave={leave} onDone={() => setPeek(undefined)} />}
    </DropZone>
  );
}

/** A tab group as one of Arc's pinned folders. Collapsing it collapses the group in the tab strip too. */
function Folder({ group, tabs }: { group: Group; tabs: Tab[] }) {
  return (
    <section className="sb-section" aria-label={group.title || 'Unnamed folder'}>
      <DropZone target={{ section: 'folder', groupId: group.id }} className="sb-folder-head">
        <button
          className="sb-row sb-folder"
          aria-expanded={!group.collapsed}
          onClick={() => void browser.tabGroups.update(group.id, { collapsed: !group.collapsed })}
        >
          <span className={`sb-folder-icon sb-color-${group.color}`} aria-hidden="true">
            {group.collapsed ? '▸' : '▾'}
          </span>
          <span className="sb-title">{group.title || 'Unnamed'}</span>
          <span className="sb-count">{tabs.length}</span>
        </button>
      </DropZone>
      {!group.collapsed && <TabList tabs={tabs} target={{ section: 'folder', groupId: group.id }} label={group.title || 'Unnamed folder'} nested />}
    </section>
  );
}

function TabList({ tabs, target, label, nested }: { tabs: Tab[]; target: DropTarget; label: string; nested?: boolean }) {
  return (
    <ul className={`sb-tabs${nested ? ' nested' : ''}`} aria-label={label}>
      {tabs.map((tab) => (
        <li key={tab.id}>
          <TabRow tab={tab} target={target} />
        </li>
      ))}
    </ul>
  );
}

function TabRow({ tab, target }: { tab: Tab; target: DropTarget }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`sb-row sb-tab${tab.active ? ' active' : ''}${over ? ' drop-before' : ''}`}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => startDrag(event, tab)}
      onDragOver={(event) => {
        allowDrop(event);
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        void drop(event, target, tab.id);
      }}
      onClick={() => void browser.tabs.update(tab.id!, { active: true })}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') void browser.tabs.update(tab.id!, { active: true });
      }}
      onAuxClick={(event) => {
        if (event.button === 1) void browser.tabs.remove(tab.id!);
      }}
      title={tab.title}
    >
      <Favicon tab={tab} size={16} />
      <span className="sb-title">{tab.title || tab.url}</span>
      {tab.audible && (
        <span className="sb-audible" aria-label="Playing audio">
          ♪
        </span>
      )}
      <button
        className="sb-close"
        aria-label={`Close ${tab.title}`}
        title="Close tab"
        onClick={(event) => {
          event.stopPropagation();
          void browser.tabs.remove(tab.id!);
        }}
      >
        ×
      </button>
    </div>
  );
}

function DropZone({ target, className, children }: { target: DropTarget; className?: string; children: React.ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`${className ?? ''}${over ? ' drop-into' : ''}`}
      onDragOver={(event) => {
        allowDrop(event);
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        void drop(event, target);
      }}
    >
      {children}
    </div>
  );
}

function startDrag(event: React.DragEvent, tab: Tab) {
  event.dataTransfer.setData(DRAG_TYPE, String(tab.id));
  event.dataTransfer.effectAllowed = 'move';
}

function allowDrop(event: React.DragEvent) {
  if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

async function drop(event: React.DragEvent, target: DropTarget, beforeTabId?: number) {
  const id = Number(event.dataTransfer.getData(DRAG_TYPE));
  if (!id) return;
  event.preventDefault();
  event.stopPropagation();
  await moveTab(id, target, beforeTabId).catch(() => undefined);
}

function Favicon({ tab, size }: { tab: Tab; size: number }) {
  const [broken, setBroken] = useState(false);
  const url = tab.favIconUrl;
  if (url && !broken && (url.startsWith('https:') || url.startsWith('data:image/'))) {
    return <img className="sb-icon" src={url} width={size} height={size} alt="" onError={() => setBroken(true)} />;
  }
  return (
    <span className="sb-icon sb-icon-letter" style={{ width: size, height: size }} aria-hidden="true">
      {(hostOf(tab.url ?? '') || tab.title || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function MiniPlayer({ items }: { items: NowPlaying[] }) {
  const item = items.find((entry) => entry.playing) ?? items[0]!;
  const act = (action: 'toggle' | 'next' | 'previous' | 'mute') => void send({ type: 'media/action', tabId: item.tabId, action });
  return (
    <section className="sb-player" aria-label="Now playing">
      <button className="sb-player-info" onClick={() => void browser.tabs.update(item.tabId, { active: true })} title="Go to this tab">
        {item.artworkUrl ? <img className="sb-player-art" src={item.artworkUrl} alt="" /> : <span className="sb-player-art" aria-hidden="true">♪</span>}
        <span className="sb-player-text">
          <span className="sb-title">{item.title}</span>
          <span className="sb-muted">{item.artist}</span>
        </span>
      </button>
      {item.controllable && (
        <span className="sb-player-controls">
          {item.canSkip && (
            <button aria-label="Previous" onClick={() => act('previous')}>
              ⏮
            </button>
          )}
          <button aria-label={item.playing ? 'Pause' : 'Play'} onClick={() => act('toggle')}>
            {item.playing ? '❚❚' : '▶'}
          </button>
          {item.canSkip && (
            <button aria-label="Next" onClick={() => act('next')}>
              ⏭
            </button>
          )}
        </span>
      )}
    </section>
  );
}

function LiveFolders({ folders, onChange }: { folders: LiveFolderView[]; onChange: (folders: LiveFolderView[]) => void }) {
  const [open, setOpen] = useState<string>();
  const openItem = async (folder: LiveFolderView, itemId: string) => {
    await send({ type: 'live/open', folderId: folder.id, itemIds: [itemId] });
    onChange(await send({ type: 'live/list' }));
  };
  return (
    <section className="sb-section" aria-label="Live Folders">
      <div className="sb-label">Live Folders</div>
      {folders.map((folder) => (
        <div key={folder.id}>
          <button className="sb-row sb-folder" aria-expanded={open === folder.id} onClick={() => setOpen(open === folder.id ? undefined : folder.id)}>
            <span className="sb-folder-icon" aria-hidden="true">
              {open === folder.id ? '▾' : '▸'}
            </span>
            <span className="sb-title">{folder.name}</span>
            {folder.unread > 0 && <span className="sb-badge">{folder.unread}</span>}
          </button>
          {open === folder.id && (
            <ul className="sb-tabs nested" aria-label={folder.name}>
              {folder.error && <li className="sb-hint">{folder.error}</li>}
              {folder.items.slice(0, 15).map((item) => (
                <li key={item.id}>
                  <button className={`sb-row sb-tab${item.unread ? ' unread' : ''}`} onClick={() => void openItem(folder, item.id)} title={item.title}>
                    <span className="sb-title">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

function Archive({ onClose, windowId }: { onClose: () => void; windowId?: number }) {
  const [entries, setEntries] = useState<ArchivedTab[]>();
  const load = useCallback(() => void send({ type: 'archive/list' }).then(setEntries), []);
  useEffect(load, [load]);
  const restore = async (entry: ArchivedTab) => {
    const [active] = await browser.tabs.query({ active: true, windowId });
    await send({ type: 'archive/restore', id: entry.id, tabId: active?.id });
    load();
  };
  return (
    <section className="sb-section" aria-label="Archive">
      <div className="sb-today-head">
        <span className="sb-label">Archive</span>
        <button className="sb-text-button" onClick={onClose}>
          Done
        </button>
      </div>
      {entries?.length === 0 && <p className="sb-hint">Tabs you clear or that auto-archive closes stay here for 30 days.</p>}
      <ul className="sb-tabs" aria-label="Archived tabs">
        {entries?.map((entry) => (
          <li key={entry.id}>
            <button className="sb-row sb-tab" onClick={() => void restore(entry)} title={`Reopen ${entry.url}`}>
              <Favicon tab={{ url: entry.url, title: entry.title, favIconUrl: entry.favIconUrl } as Tab} size={16} />
              <span className="sb-title">{entry.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function useWindowId(): number | undefined {
  const [windowId, setWindowId] = useState<number>();
  useEffect(() => {
    // ?window=<id> shows another window's tabs, for opening the sidebar as a page while testing.
    const fromQuery = Number(new URLSearchParams(location.search).get('window'));
    if (fromQuery) setWindowId(fromQuery);
    else void browser.windows.getCurrent().then((window) => setWindowId(window.id));
  }, []);
  return windowId;
}

/** The window's tabs and groups, kept current as they change. */
function useWindowTabs(windowId: number | undefined) {
  const [state, setState] = useState<{ tabs: Tab[]; groups: Group[] }>({ tabs: [], groups: [] });
  useEffect(() => {
    if (windowId === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      const [tabs, groups] = await Promise.all([browser.tabs.query({ windowId }), browser.tabGroups.query({ windowId })]);
      // Folders follow the order of their tabs in the strip.
      const firstIndex = (group: Group) => tabs.find((tab) => tab.groupId === group.id)?.index ?? Infinity;
      setState({ tabs, groups: groups.sort((a, b) => firstIndex(a) - firstIndex(b)) });
    };
    // Tab events come in bursts (a drag fires several); refresh once per burst.
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 30);
    };
    void refresh();
    const events = [
      browser.tabs.onCreated,
      browser.tabs.onRemoved,
      browser.tabs.onUpdated,
      browser.tabs.onMoved,
      browser.tabs.onActivated,
      browser.tabs.onAttached,
      browser.tabs.onDetached,
      browser.tabGroups.onCreated,
      browser.tabGroups.onUpdated,
      browser.tabGroups.onRemoved,
      browser.tabGroups.onMoved,
    ] as { addListener(fn: () => void): void; removeListener(fn: () => void): void }[];
    for (const event of events) event.addListener(schedule);
    return () => {
      clearTimeout(timer);
      for (const event of events) event.removeListener(schedule);
    };
  }, [windowId]);
  return state;
}

function useMedia(): NowPlaying[] {
  const [items, setItems] = useState<NowPlaying[]>([]);
  useEffect(() => {
    const load = () => void send({ type: 'media/list' }).then(setItems).catch(() => undefined);
    load();
    const onUpdated = (_id: number, change: Browser.tabs.OnUpdatedInfo) => {
      if ('audible' in change || 'mutedInfo' in change || change.status === 'complete') load();
    };
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(load);
    // Track titles change without an event the sidebar can see.
    const timer = setInterval(load, 10_000);
    return () => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(load);
      clearInterval(timer);
    };
  }, []);
  return items;
}

function hostOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol.startsWith('http') ? parsed.hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}
