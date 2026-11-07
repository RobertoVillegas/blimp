import { useCallback, useEffect, useRef, useState } from "react";
import { extractFromDocument } from "@/features/link-preview/extract-document";
import { splitCitations } from "@/shared/citations";
import type { BrowseFetchPage } from "@/shared/messages";
import { send } from "@/shared/send";
import type { AiStatus, BrowseSource } from "@/shared/types";
import { domainOf } from "@/shared/url";
import { AccessRequest } from "./AccessRequest";
import { Footer } from "./Footer";
import { RichText } from "./RichText";

type Phase =
  | { name: "ask" }
  | { name: "working"; label: string }
  | { name: "done"; text: string; sources: BrowseSource[]; missing: string[] }
  | { name: "error"; message: string };

const TEXT_PER_PAGE = 6_000;

/** Arc's "Browse for Me": search, read the top results, and answer with numbered sources. */
export function BrowseView({
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
  const [phase, setPhase] = useState<Phase>(
    initialQuery ? { name: "working", label: "Searching…" } : { name: "ask" },
  );
  const opRef = useRef<string | null>(null);

  const run = useCallback(async (text: string) => {
    const opId = crypto.randomUUID();
    opRef.current = opId;
    try {
      setPhase({ name: "working", label: "Searching…" });
      const pages = await send({ type: "browse/fetch", opId, query: text });
      setPhase({
        name: "working",
        label: `Reading ${pages.filter((page) => page.html).length} pages…`,
      });
      const sources = pages.map(toSource);
      const answer = await send({
        type: "browse/answer",
        opId,
        query: text,
        sources,
      });
      const missing = [
        ...new Set(
          pages
            .map((page) => page.needsOrigin)
            .filter((origin): origin is string => Boolean(origin)),
        ),
      ];
      setPhase({ name: "done", text: answer, sources, missing });
    } catch (error) {
      setPhase({
        name: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      opRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (initialQuery) void run(initialQuery);
    return () => {
      if (opRef.current) void send({ type: "op/cancel", opId: opRef.current });
    };
  }, [initialQuery, run]);

  const open = (url: string) =>
    void send({ type: "instant/open", url, tabId }).then(onClose);

  return (
    <div className="hm-page">
      <div className="hm-search">
        <input
          autoFocus={!initialQuery}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && query.trim()) {
              event.preventDefault();
              void run(query.trim());
            }
          }}
          placeholder="What should I look up for you?"
          aria-label="Browse for Me question"
        />
      </div>

      {phase.name === "ask" && (
        <p className="hm-panel hm-muted">
          Blimp searches, reads the top results and answers with sources.
        </p>
      )}

      {phase.name === "working" && (
        <div className="hm-panel" role="status" aria-live="polite">
          <div className="hm-spinner" aria-hidden="true" />
          <p>{phase.label}</p>
        </div>
      )}

      {phase.name === "done" && (
        <BrowseAnswer
          phase={phase}
          onOpen={open}
          onRetry={() => void run(query.trim())}
        />
      )}

      {phase.name === "error" && (
        <div className="hm-panel">
          <p className="hm-warning" role="alert">
            {phase.message}
          </p>
          <button className="hm-link" onClick={onBack}>
            Back to commands
          </button>
        </div>
      )}

      <Footer
        status={status}
        note={
          status?.configured
            ? `Your search goes to your search provider; the pages' text goes to ${status.profileName}.`
            : "Needs an AI profile and a search provider."
        }
      />
    </div>
  );
}

function BrowseAnswer({
  phase,
  onOpen,
  onRetry,
}: {
  phase: Extract<Phase, { name: "done" }>;
  onOpen: (url: string) => void;
  onRetry: () => void;
}) {
  const byNumber = new Map(phase.sources.map((source) => [source.n, source]));
  const inline = (line: string) =>
    splitCitations(line, new Set(byNumber.keys())).map((part, index) =>
      part.kind === "text" ? (
        part.text
      ) : (
        <button
          key={index}
          className="hm-cite"
          title={byNumber.get(part.n)!.title}
          onClick={() => onOpen(byNumber.get(part.n)!.url)}
        >
          {part.n}
        </button>
      ),
    );
  return (
    <div className="hm-conversation" aria-live="polite">
      <RichText text={phase.text} inline={inline} />
      <h3 className="hm-subhead">Sources</h3>
      <ol className="hm-sources" aria-label="Sources">
        {phase.sources.map((source) => (
          <li key={source.n}>
            <button
              className="hm-cite"
              onClick={() => onOpen(source.url)}
              aria-label={`Open source ${source.n}`}
            >
              {source.n}
            </button>
            <button
              className="hm-source-title"
              onClick={() => onOpen(source.url)}
            >
              {source.title}
            </button>
            <span className="hm-muted">
              {" "}
              {domainOf(source.url)}
              {!source.text && " · search snippet only"}
            </span>
          </li>
        ))}
      </ol>
      {phase.missing.length > 0 && (
        <AccessRequest
          origins={phase.missing}
          reason="Some results were only skimmed from their search snippets. To read them in full next time, allow access to:"
          onGranted={onRetry}
        />
      )}
    </div>
  );
}

/** Parse each page here, where there's a DOM (the service worker has none). */
function toSource(page: BrowseFetchPage): BrowseSource {
  let text = "";
  if (page.html) {
    try {
      text = extractFromDocument(
        new DOMParser().parseFromString(page.html, "text/html"),
        TEXT_PER_PAGE,
        page.url,
      ).text;
    } catch {
      text = "";
    }
  }
  return {
    n: page.n,
    url: page.url,
    title: page.title,
    snippet: page.snippet.slice(0, 1000),
    text,
  };
}
