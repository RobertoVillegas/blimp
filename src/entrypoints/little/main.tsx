import { useState } from "react";
import ReactDOM from "react-dom/client";
import { addressFor } from "@/features/little";
import "./little.css";

// The start page of a Little Blimp window: one box for a search or an address.
function Little() {
  const [text, setText] = useState("");

  async function go() {
    const query = text.trim();
    if (!query) return;
    const tab = await browser.tabs.getCurrent();
    const address = addressFor(query);
    if (address) await browser.tabs.update(tab!.id!, { url: address });
    else await browser.search.query({ text: query, tabId: tab!.id! });
  }

  return (
    <main>
      <h1>Little Blimp</h1>
      <input
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && void go()}
        placeholder="Search or enter an address"
        aria-label="Search or enter an address"
        spellCheck={false}
      />
      <p>
        For quick lookups. Keep a page with ⌘K →{" "}
        <strong>Open in Main Window</strong>; close the window when you're done.
      </p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Little />);
