import { useCallback, useEffect, useState } from 'react';
import { send } from '@/shared/send';
import type { AiStatus, TitleProposal } from '@/shared/types';
import { domainOf } from '@/shared/url';
import { AccessRequest } from './AccessRequest';
import { Footer } from './Footer';

type Phase =
  | { name: 'loading'; opId: string }
  | { name: 'review'; proposals: TitleProposal[] }
  | { name: 'done'; count: number; missing: string[] }
  | { name: 'error'; message: string };

/** AI names for pinned tabs: proposed first, edited if you like, applied only on request. */
export function TabTitlesView({ windowId, status, onBack }: { windowId?: number; status?: AiStatus; onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>({ name: 'loading', opId: '' });
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [included, setIncluded] = useState<Set<number>>(new Set());

  useEffect(() => {
    const opId = crypto.randomUUID();
    setPhase({ name: 'loading', opId });
    send({ type: 'titles/propose', opId, windowId })
      .then((proposals) => {
        setTitles(Object.fromEntries(proposals.map((p) => [p.tabId, p.proposed])));
        setIncluded(new Set(proposals.map((p) => p.tabId)));
        setPhase({ name: 'review', proposals });
      })
      .catch((error: unknown) => setPhase({ name: 'error', message: error instanceof Error ? error.message : String(error) }));
    return () => void send({ type: 'op/cancel', opId }).catch(() => undefined);
  }, [windowId]);

  async function apply(proposals: TitleProposal[]) {
    const items = proposals.filter((p) => included.has(p.tabId) && titles[p.tabId]?.trim()).map((p) => ({ tabId: p.tabId, title: titles[p.tabId]! }));
    if (!items.length) return;
    try {
      const missing = await send({ type: 'titles/apply', items });
      setPhase({ name: 'done', count: items.length, missing });
    } catch (error) {
      setPhase({ name: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  const granted = useCallback(() => setPhase((current) => (current.name === 'done' ? { ...current, missing: [] } : current)), []);

  return (
    <div className="hm-page">
      <header className="hm-page-header">
        <button className="hm-link" onClick={onBack} aria-label="Back to commands">
          ←
        </button>
        <span className="hm-page-title">Tidy Tab Titles</span>
      </header>

      {phase.name === 'loading' && (
        <div className="hm-panel" role="status" aria-live="polite">
          <div className="hm-spinner" aria-hidden="true" />
          <p>Thinking of short names for your pinned tabs…</p>
        </div>
      )}

      {phase.name === 'review' && (
        <>
          <ul className="hm-checklist hm-titles" aria-label="Proposed names">
            {phase.proposals.map((p) => (
              <li key={p.tabId}>
                <label>
                  <input
                    type="checkbox"
                    checked={included.has(p.tabId)}
                    aria-label={`Rename ${p.original}`}
                    onChange={() => {
                      const next = new Set(included);
                      if (next.has(p.tabId)) next.delete(p.tabId);
                      else next.add(p.tabId);
                      setIncluded(next);
                    }}
                  />
                  <span className="hm-title-old" title={p.original}>
                    {p.original || domainOf(p.url)}
                  </span>
                </label>
                <input
                  className="hm-title-new"
                  value={titles[p.tabId] ?? ''}
                  onChange={(event) => setTitles({ ...titles, [p.tabId]: event.target.value })}
                  onKeyDown={(event) => event.key === 'Enter' && void apply(phase.proposals)}
                  aria-label={`New name for ${p.original}`}
                  maxLength={30}
                />
              </li>
            ))}
          </ul>
          <div className="hm-run-bar">
            <button className="hm-button hm-primary" autoFocus onClick={() => void apply(phase.proposals)} disabled={included.size === 0}>
              Rename {included.size} {included.size === 1 ? 'tab' : 'tabs'}
            </button>
          </div>
          <Footer status={status} note="Only names change; the pages stay as they are. Restore Tab Titles undoes it." />
        </>
      )}

      {phase.name === 'done' && (
        <div className="hm-panel">
          <h2>
            Renamed {phase.count} {phase.count === 1 ? 'tab' : 'tabs'}
          </h2>
          {phase.missing.length > 0 ? (
            <AccessRequest
              origins={phase.missing}
              reason="The new names show now. To keep them after these pages reload, Blimp needs access to:"
              onGranted={granted}
            />
          ) : (
            <p className="hm-muted">They stay after reloads and restarts. Run Restore Tab Titles to undo.</p>
          )}
          <button className="hm-link" onClick={onBack}>
            Back to commands
          </button>
        </div>
      )}

      {phase.name === 'error' && (
        <div className="hm-panel">
          <p className="hm-warning" role="alert">
            {phase.message}
          </p>
          <button className="hm-link" onClick={onBack}>
            Back to commands
          </button>
        </div>
      )}
    </div>
  );
}

/** Give the current tab a name of your own. */
export function RenameTabView({ tabId, onBack, onClose }: { tabId?: number; onBack: () => void; onClose: () => void }) {
  const [current, setCurrent] = useState<{ tabId: number; title: string; renamed: boolean }>();
  const [value, setValue] = useState('');
  const [missing, setMissing] = useState<string[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void send({ type: 'titles/current', tabId })
      .then((info) => {
        if (!info) return;
        setCurrent(info);
        setValue(info.title);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [tabId]);

  async function rename() {
    if (!current || !value.trim()) return;
    try {
      const needed = await send({ type: 'titles/apply', items: [{ tabId: current.tabId, title: value }] });
      if (needed.length) setMissing(needed);
      else onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="hm-page">
      <div className="hm-search">
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void rename()}
          onFocus={(event) => event.target.select()}
          placeholder="New name for this tab"
          aria-label="New name for this tab"
          maxLength={30}
        />
      </div>
      <div className="hm-panel">
        {error && (
          <p className="hm-warning" role="alert">
            {error}
          </p>
        )}
        {missing ? (
          <AccessRequest
            origins={missing}
            reason="Renamed. To keep the name after this page reloads, Blimp needs access to:"
            onGranted={onClose}
          />
        ) : (
          <p className="hm-muted">Enter to rename. Only the name in the tab strip changes.</p>
        )}
        {current?.renamed && !missing && (
          <button
            className="hm-link"
            onClick={() => void send({ type: 'titles/restore', tabIds: [current.tabId] }).then(onClose)}
          >
            Restore the site's title
          </button>
        )}
        <button className="hm-link" onClick={onBack}>
          Back to commands
        </button>
      </div>
    </div>
  );
}
