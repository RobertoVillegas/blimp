# Helium Max

A Manifest V3 extension for [Helium](https://helium.computer/) that brings back the Arc Max workflows people miss: a ⌘K command palette, AI tab grouping on request, and page summaries and Q&A. You bring your own AI provider. There's no server, account or telemetry.

Not affiliated with Helium or Arc. The product spec is in [`docs/PRD.md`](docs/PRD.md).

## Status

Milestone M1 (P0) works in Chromium. It has not been tested in Helium yet; see [`docs/compatibility.md`](docs/compatibility.md).

| Feature | State |
| --- | --- |
| F01 Command palette (⌘K, ⇧⌘K fallback, toolbar) | Done |
| F02 Tidy Tabs + Undo | Done |
| F03 BYOK providers with saved profiles: OpenAI, Anthropic, Gemini, DeepSeek, Mistral, OpenCode Zen, OpenRouter, Ollama, custom OpenAI-compatible | Done (wire formats unit-tested; live calls only against a mock) |
| F04 Summarize / Ask Page | Done |
| F05 Shift-hover link previews | M2 |
| F06 Summarize / Ask across tabs | M2 |
| F07 Instant Links | M3 |
| F08 Tidy Downloads | M3 |

Exploring [TypeSafe's Jev](docs/jev.md), a decision model, to make Tidy Tabs and future grounding checks cheaper and more reliable.

## Try it

```sh
pnpm install
pnpm build
```

In Helium, open `helium://extensions` (or `chrome://extensions`), turn on Developer mode, choose **Load unpacked** and pick `.output/chrome-mv3`. Settings opens on install with a profile for each common provider (OpenAI, Anthropic, Gemini, DeepSeek, Mistral, OpenCode Zen). Pick one, paste a key, press **Load models** to choose a model ID, then **Save and use** and **Test connection**. Add more profiles for other endpoints, such as a second Mistral profile for a different model. Switch the active profile from the palette by typing “profile”.

`pnpm dev` starts WXT in watch mode with a throwaway Chromium profile.

## How it behaves

- **Nothing runs on its own.** Tidy Tabs and every AI command run only when you choose them. Ordinary browsing makes no AI requests.
- **Tidy Tabs** covers the ungrouped, unpinned tabs in the current window. It sends their titles and URLs, validates the model's plan against the real tab IDs, and only then creates native tab groups. If the plan is malformed, nothing changes. It names groups and never renames, closes or discards tabs. **Undo Tidy Tabs** restores the earlier order and reports tabs that changed in the meantime.
- **Summarize / Ask Page** reads visible article text. It skips navigation, footers, forms, password fields and hidden elements. Follow-up questions stay in session memory until you press **Forget this page conversation** or quit the browser.
- **Permissions.** The palette is injected through `activeTab` when you press the shortcut or the toolbar button, so the extension asks for no site access at install. It asks for access to your provider's API origin when you save settings.
- **Keys** stay in `storage.session` by default, which only extension pages can read and which clears when the browser quits. You can choose to keep them across restarts instead; they then go in the extension's own IndexedDB, which is not encrypted, and Settings says so.

## Development

```sh
pnpm check       # typecheck + unit tests + production build
pnpm test:e2e    # builds the e2e variant and drives it in Playwright Chromium
```

The e2e build (`--mode e2e`) adds one host permission for `http://127.0.0.1/*`, so tests can reach the fixture server. That server serves article pages and a fake OpenAI-compatible endpoint.

```text
src/
  entrypoints/      background, overlay content script, palette popup, options page
  background/       message router, palette opener (overlay or popup fallback)
  features/
    tidy-tabs/      prompt, plan validation, apply, snapshot/undo
    ask-page/       in-page extraction, grounded Q&A
  ai/               provider presets, wire adapters, model listing, errors, JSON parsing
  storage/          settings and profiles (storage.local), secrets per profile (session / IndexedDB)
  ui/palette/       palette shared by the overlay and the popup
  shared/           message contracts, types, URL guards
```
