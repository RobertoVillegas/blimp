import { useState } from "react";
import ReactDOM from "react-dom/client";
import "../options/options.css";

// Opened by the background when the in-page palette needs site access it can't request itself.
const origins = (new URLSearchParams(location.search).get("origins") ?? "")
  .split(" ")
  .filter(Boolean);

function Grant() {
  const [state, setState] = useState<"ask" | "denied">("ask");

  async function allow() {
    const granted = await browser.permissions.request({ origins });
    if (granted) window.close();
    else setState("denied");
  }

  return (
    <main className="grant">
      <h1>Allow Blimp to read these sites?</h1>
      <p className="hint">
        Needed to read the tabs you selected. Blimp reads a page only when you
        run a command on it.
      </p>
      <ul>
        {origins.map((origin) => (
          <li key={origin}>
            <code>
              {origin.replace(/^https?:\/\//, "").replace(/\/\*$/, "")}
            </code>
          </li>
        ))}
      </ul>
      {state === "denied" && (
        <p className="warning">Not allowed. Those tabs will be skipped.</p>
      )}
      <div className="actions">
        <button autoFocus onClick={() => void allow()}>
          Allow
        </button>
        <button onClick={() => window.close()}>Cancel</button>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Grant />);
