import { useEffect, useRef, useState } from "react";
import { send } from "@/shared/send";
import type { AiStatus, InstantLinksResult } from "@/shared/types";
import { Footer } from "./Footer";

type State =
  | { name: "idle" }
  | { name: "searching"; opId: string; query: string }
  | { name: "results"; query: string; result: InstantLinksResult }
  | { name: "error"; message: string };

type Row = {
  kind: "shortcut" | "result";
  title: string;
  url: string;
  detail?: string;
  best?: boolean;
};

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
  const [state, setState] = useState<State>({ name: "idle" });
  const [selected, setSelected] = useState(0);
  const opRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialQuery.trim()) void search(initialQuery);
    return () => {
      if (opRef.current) void send({ type: "op/cancel", opId: opRef.current });
    };
    // Runs once, for the query the palette passed in.
  }, []);

  async function search(text: string) {
    const opId = crypto.randomUUID();
    opRef.current = opId;
    setState({ name: "searching", opId, query: text });
    try {
      const result = await send({ type: "instant/search", opId, query: text });
      setSelected(0);
      setState({ name: "results", query: text, result });
    } catch (error) {
      setState({
        name: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      opRef.current = null;
    }
  }

  const result = state.name === "results" ? state.result : undefined;
  const rows = result ? toRows(result) : [];
  const fresh = state.name === "results" && state.query === query.trim();
  const needsProvider = Boolean(
    result && result.webRequested && !result.configured,
  );
  const topResults = result
    ? toRows(result)
        .filter((row) => row.kind === "result")
        .slice(0, result.openCount)
    : [];

  async function open(url: string) {
    try {
      await send({ type: "instant/open", url, tabId });
      onClose();
    } catch (error) {
      setState({
        name: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function openMany() {
    try {
      await send({
        type: "instant/open-many",
        urls: topResults.map((row) => row.url),
        tabId,
      });
      onClose();
    } catch (error) {
      setState({
        name: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function webSearch() {
    await send({
      type: "instant/web-search",
      query: result?.searchQuery ?? query.trim(),
    });
    onClose();
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && rows.length) {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === "ArrowUp" && rows.length) {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!query.trim()) return;
      // Enter on the results of this exact query opens; otherwise it searches.
      if (fresh && rows[selected]) void open(rows[selected]!.url);
      else if (fresh && needsProvider) void webSearch();
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
          placeholder="What do you want to open? e.g. official React docs, directions to the airport"
          aria-label="Instant Links search"
          spellCheck={false}
        />
      </div>

      {state.name === "idle" && (
        <p className="hm-panel hm-muted">
          Type what you're looking for and press Enter.
        </p>
      )}

      {state.name === "searching" && (
        <div className="hm-panel" role="status" aria-live="polite">
          <div className="hm-spinner" aria-hidden="true" />
          <p>Looking for “{state.query}”…</p>
        </div>
      )}

      {result && rows.length > 0 && (
        <ul className="hm-list" role="listbox" aria-label="Search results">
          {rows.map((row, index) => (
            <li
              key={`${row.kind}-${row.url}`}
              role="option"
              aria-selected={index === selected}
              className="hm-item hm-result-row"
              onMouseMove={() => setSelected(index)}
              onClick={() => void open(row.url)}
            >
              <span className="hm-result-title">
                {row.title}
                {row.best && <span className="hm-badge">Best match</span>}
                {row.kind === "shortcut" && (
                  <span className="hm-badge">Shortcut</span>
                )}
              </span>
              <span className="hm-result-url">{row.url}</span>
              {row.detail && (
                <span
                  className={`hm-result-snippet${row.best && result.note ? " hm-why" : ""}`}
                >
                  {row.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {result && topResults.length > 1 && (
        <div className="hm-run-bar">
          <button
            className="hm-button hm-primary"
            onClick={() => void openMany()}
          >
            Open top {topResults.length} in new tabs
          </button>
        </div>
      )}

      {result && needsProvider && (
        <div className="hm-panel">
          <p>
            No search provider is set up. Instant Links only opens links that
            come from a real search, so it won't guess a URL.
          </p>
          <div className="hm-row">
            <button
              className="hm-button hm-primary"
              autoFocus={rows.length === 0}
              onClick={() => void webSearch()}
            >
              Search “{result.searchQuery ?? query.trim()}” with your search
              engine
            </button>
            <button
              className="hm-link"
              onClick={() => {
                void send({ type: "settings/open" });
                onClose();
              }}
            >
              Set up Brave Search or SearXNG
            </button>
          </div>
        </div>
      )}

      {result && rows.length === 0 && !needsProvider && (
        <p className="hm-panel hm-muted">
          No results for “{state.name === "results" ? state.query : ""}”.
        </p>
      )}

      {state.name === "error" && (
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
          result?.configured && result.results.length
            ? `Results from ${result.providerLabel}${result.rankedBy ? ` · ranked by ${result.rankedBy}` : ""} · Enter opens in a new tab`
            : "Links come from your search provider or fixed shortcuts; the AI only picks."
        }
      />
    </div>
  );
}

/** Shortcuts first (they're what was explicitly asked for), then the best match, then the rest. */
function toRows(result: InstantLinksResult): Row[] {
  const shortcuts: Row[] = result.shortcuts.map((link) => ({
    kind: "shortcut",
    title: link.label,
    url: link.url,
  }));
  const items = result.results.map((candidate, index) => ({
    candidate,
    best: index === result.best,
  }));
  const ordered = [
    ...items.filter((item) => item.best),
    ...items.filter((item) => !item.best),
  ];
  const results: Row[] = ordered.map(({ candidate, best }) => ({
    kind: "result",
    title: candidate.title,
    url: candidate.url,
    best,
    detail: best && result.note ? result.note : candidate.snippet,
  }));
  return [...shortcuts, ...results];
}
