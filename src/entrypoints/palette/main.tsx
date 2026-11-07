import React from "react";
import ReactDOM from "react-dom/client";
import type { PaletteIntent } from "@/shared/messages";
import { Palette } from "@/ui/palette/Palette";
import "@/ui/palette/palette.css";
import "./page.css";

// Fallback palette for pages that cannot host the overlay (browser pages, the Web Store, PDFs…).
const params = new URLSearchParams(location.search);
const number = (key: string) =>
  params.has(key) ? Number(params.get(key)) : undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="hm-root hm-popup">
      <Palette
        windowId={number("windowId")}
        tabId={number("tabId")}
        intent={(params.get("intent") as PaletteIntent | null) ?? undefined}
        onClose={() => window.close()}
      />
    </div>
  </React.StrictMode>,
);
