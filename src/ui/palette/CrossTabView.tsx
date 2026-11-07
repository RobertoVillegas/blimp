import { useEffect, useMemo, useRef, useState } from "react";
import { splitCitations } from "@/shared/citations";
import { send } from "@/shared/send";
import type {
  AiStatus,
  CrossTabCandidate,
  CrossTabResult,
} from "@/shared/types";
import { domainOf } from "@/shared/url";
import { Footer } from "./Footer";
import { RichText } from "./RichText";

type Phase =
  | { name: "select" }
  | { name: "grant"; missing: string[]; waiting: boolean }
  | { name: "running"; opId: string; question: string | null }
  | { name: "result"; result: CrossTabResult; question: string | null }
  | { name: "error"; message: string };

const GRANT_POLL_MS = 1_000;

export function CrossTabView({
  mode,
  windowId,
  tabId,
  status,
  onBack,
  onClose,
}: {
  mode: "summarize" | "ask";
  windowId?: number;
  tabId?: number;
  status?: AiStatus;
  onBack: () => void;
  onClose: () => void;
}) {
  const [candidates, setCandidates] = useState<CrossTabCandidate[]>();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [question, setQuestion] = useState("");
  const [wake, setWake] = useState(false);
  const selectable = (tab: CrossTabCandidate) =>
    !tab.blocked || (wake && Boolean(tab.asleep));
  const [phase, setPhase] = useState<Phase>({ name: "select" });
  const runningOp = useRef<string | null>(null);
  const runButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void send({ type: "cross/candidates", windowId }).then((list) => {
      setCandidates(list);
      setSelected(
        new Set(list.filter((tab) => !tab.blocked).map((tab) => tab.tabId)),
      );
      if (mode === "summarize")
        requestAnimationFrame(() => runButton.current?.focus());
    });
    // Leaving the view cancels a request that is still running.
    return () => {
      if (runningOp.current)
        void send({ type: "op/cancel", opId: runningOp.current });
    };
  }, [mode, windowId]);

  // While the grant window is open, check once a second whether access arrived.
  useEffect(() => {
    if (phase.name !== "grant" || !phase.waiting) return;
    const timer = setInterval(async () => {
      const missing = await send({
        type: "cross/missing-origins",
        tabIds: [...selected],
        tabId,
      });
      if (missing.length === 0) void execute([...selected]);
    }, GRANT_POLL_MS);
    return () => clearInterval(timer);
  }, [phase, selected, tabId]);

  const selectedTabs = useMemo(
    () => candidates?.filter((tab) => selected.has(tab.tabId)) ?? [],
    [candidates, selected],
  );

  async function start(askedQuestion = question) {
    const ids = selectedTabs.map((tab) => tab.tabId);
    if (ids.length === 0) return;
    if (mode === "ask" && !askedQuestion.trim()) return;
    const missing = await send({
      type: "cross/missing-origins",
      tabIds: ids,
      tabId,
    });
    if (missing.length) setPhase({ name: "grant", missing, waiting: false });
    else void execute(ids, askedQuestion);
  }

  async function execute(ids: number[], askedQuestion = question) {
    const opId = crypto.randomUUID();
    const asked = mode === "ask" ? askedQuestion.trim() : null;
    runningOp.current = opId;
    setPhase({ name: "running", opId, question: asked });
    try {
      const result = await send({
        type: "cross/run",
        opId,
        windowId,
        tabIds: ids,
        question: asked,
        wake,
      });
      setPhase({ name: "result", result, question: asked });
    } catch (error) {
      setPhase({
        name: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      runningOp.current = null;
    }
  }

  async function grant(missing: string[]) {
    // Extension pages (the popup palette) can prompt directly; the in-page overlay can't.
    if (typeof browser.permissions?.request === "function") {
      if (await browser.permissions.request({ origins: missing }))
        void execute(selectedTabs.map((tab) => tab.tabId));
      return;
    }
    await send({ type: "permissions/open-grant", origins: missing });
    setPhase({ name: "grant", missing, waiting: true });
  }

  /** Run anyway: tabs without access are reported under Skipped instead of silently dropped. */
  function skipUngranted() {
    void execute(selectedTabs.map((tab) => tab.tabId));
  }

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const title = mode === "summarize" ? "Summarize tabs" : "Ask across tabs";
  const disclosure = status?.configured
    ? `${status.hosted ? "Sends" : "Uses"} the text of ${selectedTabs.length} ${selectedTabs.length === 1 ? "tab" : "tabs"}${status.hosted ? ` to ${status.profileName}` : ` with ${status.profileName}; it stays on this device`}.`
    : undefined;

  return (
    <div className="hm-page">
      <header className="hm-page-header">
        <button
          className="hm-link"
          onClick={onBack}
          aria-label="Back to commands"
        >
          ←
        </button>
        <span className="hm-page-title">{title}</span>
      </header>

      {phase.name === "select" && (
        <>
          {mode === "ask" && (
            <form
              className="hm-ask hm-ask-top"
              onSubmit={(event) => {
                event.preventDefault();
                void start();
              }}
            >
              <input
                autoFocus
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="What do you want to know from these tabs?"
                aria-label="Question for the selected tabs"
              />
            </form>
          )}
          <div className="hm-select-bar">
            <span className="hm-muted">
              {selectedTabs.length} of{" "}
              {candidates?.filter(selectable).length ?? 0} readable tabs
              selected
            </span>
            <button
              className="hm-link"
              onClick={() =>
                setSelected(
                  new Set(candidates?.filter(selectable).map((t) => t.tabId)),
                )
              }
            >
              All
            </button>
            <button className="hm-link" onClick={() => setSelected(new Set())}>
              None
            </button>
          </div>
          <ul className="hm-checklist" aria-label="Tabs to include">
            {candidates?.map((tab) => (
              <li key={tab.tabId}>
                <label className={tab.blocked ? "hm-blocked" : undefined}>
                  <input
                    type="checkbox"
                    checked={selected.has(tab.tabId)}
                    disabled={!selectable(tab)}
                    onChange={() => toggle(tab.tabId)}
                  />
                  <span className="hm-item-title">{tab.title}</span>
                  <span className="hm-item-hint">
                    {selectable(tab) && tab.asleep
                      ? "Will be woken"
                      : (tab.blocked ?? domainOf(tab.url))}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {candidates?.some((tab) => tab.asleep) && (
            <label className="hm-wake">
              <input
                type="checkbox"
                checked={wake}
                onChange={(event) => {
                  const on = event.target.checked;
                  setWake(on);
                  const asleep = candidates
                    .filter((tab) => tab.asleep)
                    .map((tab) => tab.tabId);
                  const next = new Set(selected);
                  for (const id of asleep) on ? next.add(id) : next.delete(id);
                  setSelected(next);
                }}
              />
              Wake sleeping tabs so they can be read (loads them in the
              background)
            </label>
          )}
          <div className="hm-run-bar">
            <button
              ref={runButton}
              className="hm-button hm-primary"
              disabled={
                selectedTabs.length === 0 ||
                (mode === "ask" && !question.trim())
              }
              onClick={() => void start()}
            >
              {mode === "summarize" ? "Summarize" : "Ask"} {selectedTabs.length}{" "}
              {selectedTabs.length === 1 ? "tab" : "tabs"}
            </button>
          </div>
          <Footer
            status={status}
            note={
              disclosure ??
              "Tabs are read only after you press the button. Sleeping tabs are not reloaded."
            }
          />
        </>
      )}

      {phase.name === "grant" && (
        <div className="hm-panel">
          <h2>
            Blimp needs access to read{" "}
            {phase.missing.length === 1 ? "this site" : "these sites"}
          </h2>
          <ul className="hm-plain-list">
            {phase.missing.map((origin) => (
              <li key={origin}>
                <code>
                  {origin.replace(/^https?:\/\//, "").replace(/\/\*$/, "")}
                </code>
              </li>
            ))}
          </ul>
          {phase.waiting ? (
            <p className="hm-muted" role="status">
              Waiting for you to allow access in the Blimp window…
            </p>
          ) : (
            <p className="hm-muted">
              Access is remembered for these sites. You can remove it in the
              extension's details.
            </p>
          )}
          <div className="hm-row">
            <button
              className="hm-button hm-primary"
              autoFocus
              onClick={() => void grant(phase.missing)}
            >
              Allow access
            </button>
            <button className="hm-button" onClick={skipUngranted}>
              Skip those tabs
            </button>
          </div>
        </div>
      )}

      {phase.name === "running" && (
        <div className="hm-panel" role="status" aria-live="polite">
          <div className="hm-spinner" aria-hidden="true" />
          <p>Reading {selectedTabs.length} tabs…</p>
          <button
            className="hm-button"
            onClick={() => void send({ type: "op/cancel", opId: phase.opId })}
          >
            Cancel
          </button>
        </div>
      )}

      {phase.name === "result" && (
        <CrossTabAnswer
          result={phase.result}
          question={phase.question}
          onOpen={(id) =>
            void send({ type: "tabs/activate", tabId: id }).then(onClose)
          }
          onAsk={
            mode === "ask"
              ? (next) =>
                  void execute(
                    phase.result.sources.map((source) => source.tabId),
                    next,
                  )
              : undefined
          }
        />
      )}

      {phase.name === "error" && (
        <div className="hm-panel">
          <p className="hm-warning" role="alert">
            {phase.message}
          </p>
          <button
            className="hm-button"
            autoFocus
            onClick={() => setPhase({ name: "select" })}
          >
            Back to tab selection
          </button>
        </div>
      )}
    </div>
  );
}

function CrossTabAnswer({
  result,
  question,
  onOpen,
  onAsk,
}: {
  result: CrossTabResult;
  question: string | null;
  onOpen: (tabId: number) => void;
  onAsk?: (question: string) => void;
}) {
  const [next, setNext] = useState("");
  const byNumber = new Map(result.sources.map((source) => [source.n, source]));
  const valid = new Set(byNumber.keys());

  const inline = (line: string) =>
    splitCitations(line, valid).map((part, index) =>
      part.kind === "text" ? (
        part.text
      ) : (
        <button
          key={index}
          className="hm-cite"
          title={byNumber.get(part.n)!.title}
          aria-label={`Source ${part.n}: ${byNumber.get(part.n)!.title}`}
          onClick={() => onOpen(byNumber.get(part.n)!.tabId)}
        >
          {part.n}
        </button>
      ),
    );

  return (
    <>
      <div className="hm-conversation" aria-live="polite">
        {question && <p className="hm-question">{question}</p>}
        <RichText text={result.text} inline={inline} />
        <h3 className="hm-subhead">Sources</h3>
        <ol className="hm-sources">
          {result.sources.map((source) => (
            <li key={source.n}>
              <button
                className="hm-cite"
                onClick={() => onOpen(source.tabId)}
                aria-label={`Open source ${source.n}`}
              >
                {source.n}
              </button>
              <button
                className="hm-source-title"
                onClick={() => onOpen(source.tabId)}
              >
                {source.title}
              </button>
              <span className="hm-muted">
                {" "}
                {domainOf(source.url)}
                {source.truncated && " · only the start was read"}
              </span>
            </li>
          ))}
        </ol>
        {result.skipped.length > 0 && (
          <>
            <h3 className="hm-subhead">Skipped</h3>
            <ul className="hm-skipped">
              {result.skipped.map((tab) => (
                <li key={tab.tabId}>
                  {tab.title} <span className="hm-muted">· {tab.reason}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {onAsk && (
        <form
          className="hm-ask"
          onSubmit={(event) => {
            event.preventDefault();
            if (next.trim()) onAsk(next.trim());
          }}
        >
          <input
            autoFocus
            value={next}
            onChange={(event) => setNext(event.target.value)}
            placeholder="Ask another question about these tabs…"
            aria-label="Another question for these tabs"
          />
        </form>
      )}
      <Footer
        note={
          result.calls > 1
            ? `Long input: read in ${result.calls - 1} batches, then combined.`
            : "Click a number to jump to that tab."
        }
      />
    </>
  );
}
