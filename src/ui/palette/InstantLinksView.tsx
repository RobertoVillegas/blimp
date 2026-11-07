import { useEffect, useRef, useState } from 'react';
import { send } from '@/shared/send';
import type { AiStatus, InstantLinksResult, SearchCandidate } from '@/shared/types';
import { Footer } from './Footer';

type State =
  | { name: 'idle' }
  | { name: 'searching'; opId: string; query: string }
  | { name: 'results'; query: string; result: InstantLinksResult }
  | { name: 'error'; message: string };

export function InstantLinksView({
  initialQuery,
  tabId,
  status,
  onBack,
  onClose,
}: {
  initialQuery: string;
  tabId?: number;
  status?: AiStatus;
  onBack: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ name: 'idle' });
  const [selected, setSelected] = useState(0);
  const opRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialQuery.trim()) void search(initialQuery);
    return () => {
      if (opRef.current) void send({ type: 'op/cancel', opId: opRef.current });
    };
    // Runs once, for the query the palette passed in.
  }, []);

  async function search(text: string) {
    const opId = crypto.randomUUID();
    opRef.current = opId;
    setState({ name: 'searching', opId, query: text });
    try {
      const result = await send({ type: 'instant/search', opId, query: text });
      setSelected(0);
      setState({ name: 'results', query: text, result });
    } catch (error) {
      setState({ name: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      opRef.current = null;
    }
  }

  const ordered = state.name === 'results' ? orderResults(state.result) : [];
  const fresh = state.name === 'results' && state.query === query.trim();

  async function open(candidate: SearchCandidate) {
    try {
      await send({ type: 'instant/open', url: candidate.url, tabId });
      onClose();
    } catch (error) {
      setState({ name: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function webSearch() {
    await send({ type: 'instant/web-search', query: query.trim() });
    onClose();
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && ordered.length) {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, ordered.length - 1));
    } else if (event.key === 'ArrowUp' && ordered.length) {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!query.trim()) return;
      // Enter on the results of this exact query opens; otherwise it searches.
      if (fresh && state.result.configured && ordered[selected]) void open(ordered[selected]!.candidate);
      else if (fresh && !state.result.configured) void webSearch();
      else void search(query.trim());
    }
  };

  return (
    <div className="hm-page">
      <div className="hm-search">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What do you want to open? e.g. official React docs"
          aria-label="Instant Links search"
          spellCheck={false}
        />
      </div>

      {state.name === 'idle' && <p className="hm-panel hm-muted">Type what you're looking for and press Enter.</p>}

      {state.name === 'searching' && (
        <div className="hm-panel" role="status" aria-live="polite">
          <div className="hm-spinner" aria-hidden="true" />
          <p>Searching for “{state.query}”…</p>
        </div>
      )}

      {state.name === 'results' && !state.result.configured && (
        <div className="hm-panel">
          <p>
            No search provider is set up. Instant Links only opens links that come from a real search, so it won't guess
            a URL.
          </p>
          <div className="hm-row">
            <button className="hm-button hm-primary" autoFocus onClick={() => void webSearch()}>
              Search “{state.query}” with your search engine
            </button>
            <button
              className="hm-link"
              onClick={() => {
                void send({ type: 'settings/open' });
                onClose();
              }}
            >
              Set up Brave Search or SearXNG
            </button>
          </div>
        </div>
      )}

      {state.name === 'results' && state.result.configured && (
        <ul className="hm-list" role="listbox" aria-label="Search results">
          {ordered.length === 0 && <li className="hm-empty">No results for “{state.query}”.</li>}
          {ordered.map(({ candidate, best }, index) => (
            <li
              key={candidate.url}
              role="option"
              aria-selected={index === selected}
              className="hm-item hm-result-row"
              onMouseMove={() => setSelected(index)}
              onClick={() => void open(candidate)}
            >
              <span className="hm-result-title">
                {candidate.title}
                {best && <span className="hm-badge">Best match</span>}
              </span>
              <span className="hm-result-url">{candidate.url}</span>
              {best && state.result.note ? (
                <span className="hm-result-snippet hm-why">{state.result.note}</span>
              ) : (
                candidate.snippet && <span className="hm-result-snippet">{candidate.snippet}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {state.name === 'error' && (
        <div className="hm-panel">
          <p className="hm-warning" role="alert">
            {state.message}
          </p>
          <button className="hm-link" onClick={onBack}>
            Back to commands
          </button>
        </div>
      )}

      <Footer
        status={status}
        note={
          state.name === 'results' && state.result.configured
            ? `Results from ${state.result.providerLabel}${state.result.rankedBy ? ` · ranked by ${state.result.rankedBy}` : ''} · Enter opens in a new tab`
            : 'Links come from your search provider; the AI only ranks them.'
        }
      />
    </div>
  );
}

/** Best match first, then the search engine's order. */
function orderResults(result: InstantLinksResult) {
  const items = result.results.map((candidate, index) => ({ candidate, best: index === result.best }));
  return [...items.filter((item) => item.best), ...items.filter((item) => !item.best)];
}
