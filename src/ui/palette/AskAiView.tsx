import { useEffect, useRef, useState } from "react";
import { send } from "@/shared/send";
import type { AiStatus } from "@/shared/types";
import { Footer } from "./Footer";
import { RichText } from "./RichText";

type Turn = { role: "user" | "assistant"; content: string };

/** Ask anything from the command bar (Arc's ChatGPT-in-the-command-bar), with follow-ups. */
export function AskAiView({
  question,
  status,
  onBack,
}: {
  question: string;
  status?: AiStatus;
  onBack: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [next, setNext] = useState("");
  const opRef = useRef<string | null>(null);
  const started = useRef(false);

  async function ask(history: Turn[]) {
    const opId = crypto.randomUUID();
    opRef.current = opId;
    setTurns(history);
    setPending(true);
    setError(undefined);
    try {
      const answer = await send({ type: "ai/ask", opId, messages: history });
      setTurns([...history, { role: "assistant", content: answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
      opRef.current = null;
    }
  }

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void ask([{ role: "user", content: question }]);
    }
    return () => {
      if (opRef.current) void send({ type: "op/cancel", opId: opRef.current });
    };
    // Runs once, for the question the palette passed in.
  }, []);

  const disclosure = status?.configured
    ? status.hosted
      ? `Sends your question to ${status.profileName}. It doesn't see your tabs.`
      : `Answered by ${status.profileName} on this device.`
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
        <span className="hm-page-title">Ask AI</span>
      </header>
      <div className="hm-conversation" aria-live="polite">
        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <p key={index} className="hm-question">
              {turn.content}
            </p>
          ) : (
            <div key={index} className="hm-turn">
              <RichText text={turn.content} />
            </div>
          ),
        )}
        {pending && <p className="hm-muted">Thinking…</p>}
        {error && (
          <p className="hm-warning" role="alert">
            {error}
          </p>
        )}
      </div>
      <form
        className="hm-ask"
        onSubmit={(event) => {
          event.preventDefault();
          if (!next.trim() || pending) return;
          void ask([...turns, { role: "user", content: next.trim() }]);
          setNext("");
        }}
      >
        <input
          autoFocus
          value={next}
          onChange={(event) => setNext(event.target.value)}
          placeholder="Ask a follow-up…"
          aria-label="Follow-up question"
          disabled={pending}
        />
      </form>
      <Footer status={status} note={disclosure} />
    </div>
  );
}
