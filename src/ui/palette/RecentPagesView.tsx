import { useEffect, useRef, useState } from "react";
import { send } from "@/shared/send";
import type { RecentPage } from "@/shared/types";
import { Footer } from "./Footer";

/** Arc's recent-pages preview: the last pages you visited on this site or a pinned tab's site. */
export function RecentPagesView({
  tabId,
  onBack,
  onClose,
}: {
  tabId?: number;
  onBack: () => void;
  onClose: () => void;
}) {
  const [sites, setSites] = useState<string[]>();
  const [site, setSite] = useState<string>();
  const [pages, setPages] = useState<RecentPage[]>();
  const [error, setError] = useState<{ message: string; setup: boolean }>();
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void send({ type: "recent/sites", tabId }).then((list) => {
      setSites(list);
      setSite(list[0]);
    });
  }, [tabId]);

  useEffect(() => {
    if (!site) return;
    setPages(undefined);
    setSelected(0);
    send({ type: "recent/list", host: site, tabId })
      .then((list) => {
        setPages(list);
        setError(undefined);
        root.current?.focus();
      })
      .catch((err: Error & { kind?: string }) =>
        setError({ message: err.message, setup: err.kind === "permission" }),
      );
  }, [site, tabId]);

  const open = (page: RecentPage) =>
    void send({ type: "recent/open", url: page.url, tabId }).then(onClose);

  return (
    <div
      ref={root}
      className="hm-page hm-focus-none"
      tabIndex={-1}
      onKeyDown={(event) => {
        const list = pages ?? [];
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelected((i) => Math.min(i + 1, list.length - 1));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelected((i) => Math.max(i - 1, 0));
        } else if (
          event.key === "Enter" &&
          list[selected] &&
          (event.target as HTMLElement).tagName !== "BUTTON"
        ) {
          event.preventDefault();
          open(list[selected]!);
        }
      }}
    >
      <header className="hm-page-header">
        <button
          className="hm-link"
          onClick={onBack}
          aria-label="Back to commands"
        >
          ←
        </button>
        <span className="hm-page-title">Recent Pages</span>
      </header>
      {sites && sites.length > 1 && (
        <div className="hm-chips" role="tablist" aria-label="Sites">
          {sites.map((host) => (
            <button
              key={host}
              role="tab"
              aria-selected={host === site}
              className="hm-chip"
              onClick={() => setSite(host)}
            >
              {host.replace(/^www\./, "")}
            </button>
          ))}
        </div>
      )}
      {sites && sites.length === 0 && (
        <p className="hm-panel hm-muted">
          Open a web page or pin a tab, and its recent pages show here.
        </p>
      )}
      {error && (
        <div className="hm-panel">
          <p
            className={error.setup ? undefined : "hm-warning"}
            role={error.setup ? undefined : "alert"}
          >
            {error.message}
          </p>
          {error.setup && (
            <button
              className="hm-button hm-primary"
              onClick={() => void send({ type: "settings/open" }).then(onClose)}
            >
              Open Settings
            </button>
          )}
        </div>
      )}
      {pages && pages.length === 0 && (
        <p className="hm-panel hm-muted">
          No other pages visited on {site} in the last 30 days.
        </p>
      )}
      <ul
        className="hm-list"
        role="listbox"
        aria-label={`Recent pages on ${site ?? ""}`}
      >
        {pages?.map((page, index) => (
          <li
            key={page.url}
            role="option"
            aria-selected={index === selected}
            className="hm-item hm-result-row"
            onMouseMove={() => setSelected(index)}
            onClick={() => open(page)}
          >
            <span className="hm-result-title">{page.title}</span>
            <span className="hm-result-snippet">
              {new URL(page.url).pathname} ·{" "}
              {new Date(page.visitedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </li>
        ))}
      </ul>
      <Footer note="From your browsing history on this device. Enter switches to the page or opens it." />
    </div>
  );
}
