import { useEffect, useRef, useState } from 'react';
import { send } from '@/shared/send';
import type { LiveFolderView } from '@/shared/types';
import { Footer } from './Footer';

/** Arc's Live Folders: GitHub searches and feeds, with what's new marked. */
export function LiveFoldersView({ tabId, onBack, onClose }: { tabId?: number; onBack: () => void; onClose: () => void }) {
  const [folders, setFolders] = useState<LiveFolderView[]>();
  const [openId, setOpenId] = useState<string>();
  const [selected, setSelected] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Arrow keys and Enter work as soon as the view opens.
  useEffect(() => root.current?.focus(), [openId]);

  useEffect(() => {
    void send({ type: 'live/list' }).then((list) => {
      setFolders(list);
      // Then refresh anything stale in the background.
      void send({ type: 'live/list', refresh: true }).then(setFolders);
    });
  }, []);

  const folder = folders?.find((item) => item.id === openId);
  const rows = folder ? folder.items : (folders ?? []);

  const open = (itemIds: string[]) => void send({ type: 'live/open', folderId: folder!.id, itemIds, tabId }).then(onClose);
  const activate = (index: number) => {
    if (!folder) {
      const next = folders?.[index];
      if (next) {
        setOpenId(next.id);
        setSelected(0);
      }
    } else if (folder.items[index]) open([folder.items[index]!.id]);
  };

  async function refresh() {
    setRefreshing(true);
    setFolders(await send({ type: 'live/refresh', folderId: folder?.id }));
    setRefreshing(false);
    // Back to the list, so Enter opens instead of refreshing again.
    root.current?.focus();
  }

  return (
    <div
      ref={root}
      className="hm-page hm-focus-none"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelected((i) => Math.min(i + 1, rows.length - 1));
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelected((i) => Math.max(i - 1, 0));
        } else if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') {
          event.preventDefault();
          activate(selected);
        } else if (event.key === 'Backspace' && folder) {
          event.preventDefault();
          setOpenId(undefined);
        }
      }}
    >
      <header className="hm-page-header">
        <button className="hm-link" onClick={() => (folder ? setOpenId(undefined) : onBack())} aria-label="Back">
          ←
        </button>
        <span className="hm-page-title">{folder ? folder.name : 'Live Folders'}</span>
        {folder && folder.unread > 0 && (
          <>
            <button className="hm-link" onClick={() => open(folder.items.filter((item) => item.unread).slice(0, 10).map((item) => item.id))}>
              Open {Math.min(folder.unread, 10)} new
            </button>
            <button
              className="hm-link"
              onClick={() =>
                void send({ type: 'live/seen', folderId: folder.id, itemIds: folder.items.map((item) => item.id) }).then(() =>
                  send({ type: 'live/list' }).then(setFolders),
                )
              }
            >
              Mark all read
            </button>
          </>
        )}
        <button className="hm-link" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {folders && folders.length === 0 && (
        <div className="hm-panel">
          <p>No Live Folders yet. Add GitHub searches or RSS feeds in Settings › Live Folders.</p>
          <button className="hm-button hm-primary" autoFocus onClick={() => void send({ type: 'settings/open' }).then(onClose)}>
            Open Settings
          </button>
        </div>
      )}

      {folder?.error && (
        <p className="hm-panel hm-warning" role="alert">
          {folder.error}
        </p>
      )}

      <ul className="hm-list" role="listbox" aria-label={folder ? `${folder.name} items` : 'Live Folders'}>
        {!folder &&
          folders?.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === selected} className="hm-item" onMouseMove={() => setSelected(index)} onClick={() => activate(index)}>
              <span className="hm-icon" aria-hidden="true">
                {item.kind === 'github' ? '⑂' : '◉'}
              </span>
              <span className="hm-item-title">{item.name}</span>
              <span className="hm-item-hint">
                {item.error ? 'Error' : item.unread ? <span className="hm-badge">{item.unread} new</span> : `${item.items.length} ${item.items.length === 1 ? 'item' : 'items'}`}
              </span>
            </li>
          ))}
        {folder?.items.map((item, index) => (
          <li
            key={item.id}
            role="option"
            aria-selected={index === selected}
            className={`hm-item hm-result-row${item.unread ? ' hm-unread' : ''}`}
            onMouseMove={() => setSelected(index)}
            onClick={() => activate(index)}
          >
            <span className="hm-result-title">
              {item.unread && <span className="hm-dot hm-color-blue" aria-label="New" />}
              {item.title}
            </span>
            <span className="hm-result-snippet">
              {[item.subtitle, item.date && new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      <Footer note={folder ? 'Enter opens · Backspace goes back to the folders' : 'Refreshed every 30 minutes. Enter opens a folder.'} />
    </div>
  );
}
