// Inlined into the preview card's shadow root. A plain string keeps the hover script free of CSS tooling.
export const CARD_CSS = `
.card {
  --bg: #ffffff;
  --fg: #1d1d1f;
  --muted: #6e6e73;
  --border: rgb(0 0 0 / 0.1);
  --accent: #0066cc;
  position: fixed;
  width: 340px;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg);
  color: var(--fg);
  box-shadow: 0 12px 36px rgb(0 0 0 / 0.2), 0 0 0 1px var(--border);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

@media (prefers-color-scheme: dark) {
  .card {
    --bg: #232326;
    --fg: #f2f2f4;
    --muted: #a1a1a8;
    --border: rgb(255 255 255 / 0.12);
    --accent: #4da3ff;
    box-shadow: 0 12px 36px rgb(0 0 0 / 0.5), 0 0 0 1px var(--border);
  }
}

.image {
  display: block;
  width: calc(100% + 28px);
  max-height: 150px;
  margin: -12px -14px 10px;
  object-fit: cover;
  border-radius: 10px 10px 0 0;
  background: var(--border);
}

.domain {
  color: var(--muted);
  font-size: 11px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.title {
  margin-top: 2px;
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.body {
  margin: 6px 0 0;
}

.body.loading,
.body.muted {
  color: var(--muted);
}

.actions {
  margin-top: 8px;
}

button {
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
`;
