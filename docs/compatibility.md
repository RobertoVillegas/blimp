# M0 compatibility notes

Results from the 2026-11-06 spike. The extension was exercised in **Playwright Chromium 158** (headless, macOS arm64). **Helium itself has not been tested yet**: it wasn't installed on the build host. Run the checklist at the end on a real Helium install before calling M1 done.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Bundler | WXT 0.21 + React 19 + TypeScript | First-class MV3 support, runtime-registered content scripts, shadow-root UI helper, Vitest plugin. |
| Palette host | Shadow-root overlay injected on demand; `palette.html` popup as the fallback | No install-time site access. The overlay can't run on browser pages or the Web Store, so those get the popup. |
| Shortcut | `open-palette` suggests ⌘K / Ctrl+K; `open-palette-fallback` suggests ⇧⌘K / Ctrl+Shift+K | If the browser refuses ⌘K, the fallback and the toolbar button still work. After the first open on a page, the overlay also listens for ⌘K in that page. |
| Overlay CSS | Inlined into the shadow root | WXT's default exposes the CSS as a web-accessible resource on every site, which lets pages fingerprint the extension. |
| Host permissions | None required. Provider origins and `http(s)://*/*` are optional and requested at use | Least privilege (PRD §8). WXT adds `<all_urls>` for runtime content scripts by default; a build hook removes it. |
| Persistent keys | IndexedDB on the extension origin | Content scripts can read `storage.local` but not the extension origin's IndexedDB. |
| Structured output | Ask for JSON (provider JSON mode where available), extract, then validate with zod | Works the same across all six adapters. |

## Matrix

| Capability | Chromium 158 | Helium |
| --- | --- | --- |
| Unpacked MV3 extension loads | ✅ e2e | ☐ |
| `commands` grants ⌘K and ⇧⌘K | ✅ (`commands.getAll` shows both) | ☐ (Helium may reserve ⌘K) |
| `activeTab` + `scripting.executeScript` overlay | ✅ e2e (via host permission in the e2e build) | ☐ check with the real shortcut and toolbar click |
| Popup fallback on `chrome://` pages | ✅ e2e (page opened directly) | ☐ check `action.openPopup()` from a shortcut |
| `tabs.group` / `tabGroups.update` native groups | ✅ e2e | ☐ check Helium's vertical tabs render group names and colors |
| Undo restores exact order, keeps pinned tabs and user groups | ✅ e2e + unit | ☐ |
| `storage.session` blocked from content scripts | ✅ e2e | ☐ |
| Provider calls from the service worker | ✅ against the local mock only | ☐ one real call per hosted provider; Ollama with `OLLAMA_ORIGINS` |
| Cross-tab reading via `scripting.executeScript` + per-site optional host permissions | ✅ e2e (grant prompt itself not automatable) | ☐ check the grant window flow from the overlay |
| `scripting.registerContentScripts` for the hover script, injected only where access is granted | ✅ e2e | ☐ |
| Shift-hover preview: cookie-less fetch, private-network guard, sign-in detection | ✅ e2e + unit | ☐ try a few real sites |
| `search.query` fallback for Instant Links | ✅ e2e (button shown; opening the engine not asserted) | ☐ check it uses Helium's default engine |
| Optional `downloads` permission + `onDeterminingFilename`, one `suggest()`, 4 s fallback | ✅ e2e with real files on disk (Playwright's download interception turned off) | ☐ |

## Risks to verify

- **⌘K in Helium.** If Helium binds ⌘K itself, `commands.getAll()` returns an empty shortcut and Settings shows a warning. Check that.
- **`action.openPopup()`** needs a focused normal window. If it fails, the code opens `palette.html` in a small popup window instead.
- **Ollama origin check.** Ollama rejects unknown origins. Start it with `OLLAMA_ORIGINS="chrome-extension://*"` and confirm the exact pattern Helium's extension origin needs.
- **Anthropic from the extension** needs `anthropic-dangerous-direct-browser-access: true`. The adapter sends it; confirm with a real key.
- **Bundle size.** The overlay script is about 330 kB because of React. It loads only when you open the palette, but if Helium misses the 200 ms palette target, move the palette to Preact.

## Helium checklist

1. `pnpm build`, then load `.output/chrome-mv3` unpacked in a fresh Helium profile.
2. Settings opens on install. Configure a provider and press **Test connection**.
3. Press ⌘K on a normal HTTPS page: the overlay opens and Esc closes it. Try ⇧⌘K and the toolbar button. Press ⌘K on `helium://settings`: the popup palette opens.
4. Open about 12 mixed tabs, pin one, and put two in a group by hand. Run Tidy Tabs, check the group names and colors, then Undo.
5. Run Summarize Page on an article and ask a follow-up. On a PDF or browser page, check that the error is clear.
6. Ask Across Tabs with tabs from two or three different sites; allow access in the window that opens; click the citation numbers.
7. Turn on Link previews in Settings, reload a page, hold Shift over links: an article, a sign-in page, a PDF.
8. Set up Brave Search or SearXNG and try Instant Links; then set it to None and check the fallback search.
9. Turn on Tidy Downloads and download a PDF with an ugly name; then try with the active profile pointed at something slow or broken.
