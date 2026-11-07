import { useEffect, useState } from 'react';
import { send } from '@/shared/send';
import type { ArchivedTab } from '@/shared/types';
import { domainOf } from '@/shared/url';
import { matches } from './commands';
import { Footer } from './Footer';

/** Tabs that auto-archive closed, searchable; Enter reopens one. */
export function ArchiveView({ tabId, onBack, onClose }: { tabId?: number; onBack: () => void; onClose: () => void }) {
  const [entries, setEntries] = useState<ArchivedTab[]>();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    void send({ type: 'archive/list' }).then(setEntries);
  }, []);

  const shown = (entries ?? []).filter((entry) => matches(query, entry.title, entry.url));
  const restore = (entry: ArchivedTab) => void send({ type: 'archive/restore', id: entry.id, tabId }).then(onClose);

  return (
    <div className="hm-page">
      <div className="hm-search">
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSelected((i) => Math.min(i + 1, shown.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSelected((i) => Math.max(i - 1, 0));
            } else if (event.key === 'Enter' && shown[selected]) {
              event.preventDefault();
              restore(shown[selected]!);
            }
          }}
          placeholder="Search archived tabs"
          aria-label="Search archived tabs"
        />
      </div>
      {entries && entries.length === 0 && (
        <p className="hm-panel hm-muted">
          Nothing archived yet. Turn on auto-archive in Settings › Tabs, or this list fills as tabs get archived.
        </p>
      )}
      <ul className="hm-list" role="listbox" aria-label="Archived tabs">
        {shown.map((entry, index) => (
          <li
            key={entry.id}
            role="option"
            aria-selected={index === selected}
            className="hm-item"
            onMouseMove={() => setSelected(index)}
            onClick={() => restore(entry)}
          >
            <span className="hm-icon" aria-hidden="true">
              {entry.favIconUrl ? <img src={entry.favIconUrl} alt="" /> : '◻'}
            </span>
            <span className="hm-item-title">{entry.title}</span>
            <span className="hm-item-hint">
              {domainOf(entry.url)} · {ago(entry.archivedAt)}
            </span>
          </li>
        ))}
      </ul>
      <div className="hm-run-bar">
        {entries && entries.length > 0 && (
          <button className="hm-link" onClick={() => void send({ type: 'archive/clear' }).then(() => setEntries([]))}>
            Clear archive
          </button>
        )}
        <button className="hm-link" onClick={onBack}>
          Back to commands
        </button>
      </div>
      <Footer note="Archived tabs are kept on this device for 30 days. Enter reopens one." />
    </div>
  );
}

function ago(at: number): string {
  const hours = Math.round((Date.now() - at) / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
