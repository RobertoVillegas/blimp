# Helium Max — Product Requirements Document

**Version:** 1.0 (implementation brief)  
**Status:** Proposed / ready for technical discovery  
**Date:** 2026-11-06  
**Platform:** Helium Browser (Chromium-compatible extension, Manifest V3)  
**Project name:** *Helium Max* (working name; not affiliated with Helium or Arc)

## 1. Product summary

Helium Max is a **single, local-first, bring-your-own-key (BYOK) browser extension** that recreates the most useful Arc Max workflows inside Helium: link summaries on Shift-hover, webpage Q&A, manual AI tab grouping, smart download filenames, AI-assisted navigation, cross-tab summaries, and a keyboard-first command palette.

The product is **explicitly user-initiated**. **Tab grouping happens only when the user chooses “Tidy Tabs”** from a button or command, not automatically or on a schedule. Individual tabs are **never renamed**. AI may name *tab groups*.

A native-browser fork is **not** a requirement for v1. The UI should be implemented using a Manifest V3 extension, accepting the browser's extension API and privileged-page limitations.

## 2. Problem and objectives

### Problem

Users migrating from Arc to Helium lose fast AI-assisted browsing and tab organization. Existing extensions are fragmented, often subscription-bound, and rarely offer a coherent BYOK experience.

### Primary goal

Provide the Arc Max-inspired functions in **one installable Helium extension**, using user-selected hosted or local AI providers and a fast, consistent interface.

### Product principles

1. **On demand, not autonomous:** no background AI tab grouping, mass browsing, or unrequested page-content uploads.
2. **Preserve browser state:** never close tabs, change tab titles, or silently destroy existing groups; support undo.
3. **BYOK and privacy:** direct-to-provider calls where possible; no mandatory account, proxy, telemetry, or subscription.
4. **Keyboard first:** a `Cmd+K` command palette on macOS, plus button and fallback shortcut.
5. **Honest degradation:** inaccessible pages, unavailable shortcuts, missing permissions, or absent search providers must produce clear fallbacks.

### Out of scope

- Automatically grouping tabs in the background or on a timer.
- Renaming **individual** tab titles (including pinned tabs).
- Replacing Helium's native address bar, tab strip, or privileged internal pages.
- A proprietary hosted AI backend, user accounts, billing, or synchronization service.
- Scraping restricted content, bypassing paywalls/authentication, or accessing private browser pages.
- Autonomous tab closing, bulk deletion, or navigation without an explicit user action.
- Changing already-downloaded files on disk (Tidy Downloads affects filename selection *before* save).

## 3. Users and jobs to be done

**Primary user:** macOS power user of Helium with many research/work tabs, familiar with Arc, and comfortable configuring an API key or local model.

**Jobs:**

- “When my tabs become messy, I want to press one command and have them sensibly grouped and named.”
- “When I see a link, I want a short summary without opening it.”
- “When reading an article, I want to ask questions grounded in that article.”
- “When researching across tabs, I want a synthesis with links back to sources.”
- “When I need an action, I want `Cmd+K` instead of hunting through menus.”
- “I want to choose my AI provider and retain control over data sent to it.”

## 4. Scope and priority

| ID | Feature | Priority | Trigger |
| --- | --- | --- | --- |
| F01 | Command palette | P0 | `Cmd+K` when available, fallback shortcut, toolbar button |
| F02 | Tidy Tabs: AI group + group names | P0 | Explicit button or palette command only |
| F03 | BYOK provider configuration | P0 | Settings |
| F04 | Summarize / Ask on Page | P0 | Palette, context menu, or button |
| F05 | 5-Second-style link previews | P1 | Hold Shift while hovering over a link |
| F06 | Summarize / Ask across tabs | P1 | Explicit palette command |
| F07 | Instant Links-style search + direct navigation | P1 | Explicit palette query/command |
| F08 | Tidy Downloads: AI filename suggestion | P1 | Per-download event, **opt-in feature** |

**Release target:** v1 includes F01–F08, delivered through incremental milestones. P0 and P1 denote implementation sequence, not permission to silently omit P1 from a claimed complete release.

## 5. Detailed functional requirements

### F01 — `Cmd+K` command palette

**User story:** From an ordinary webpage, I can invoke a centered, keyboard-navigable modal to run browser and AI commands.

**Requirements**

- Open/close via `Cmd+K` on macOS **when Helium permits it**; register extension commands and provide a documented fallback (default `Cmd+Shift+K`) and toolbar entry.
- Search local commands and currently open tabs immediately; type a tab title/URL to filter and press Enter to activate it.
- Commands: **Tidy Tabs, Undo Tidy Tabs, Summarize Page, Ask Page, Summarize Tabs, Ask Across Tabs, Instant Links, AI Settings**.
- Support keyboard navigation (`↑`, `↓`, `Enter`, `Esc`), focus management, accessible labels, visible loading/error states, and an action history limited to the current interaction.
- Open as a DOM overlay on supported pages, isolated from site CSS; fall back to an extension popup on privileged or otherwise unsupported pages.
- Show provider/model indicator and a concise disclosure when page or tab content will be sent to an AI provider.

**Acceptance:** On a normal HTTPS page, the palette opens with the configured shortcut or toolbar action, filters commands/tabs without AI, and closes on Esc. If Helium reserves `Cmd+K`, the fallback works and the user sees instructions for shortcut configuration.

### F02 — Manual AI Tidy Tabs

**User story:** I click “Tidy Tabs” to organize the current window into labeled native browser tab groups.

**Requirements**

- **Never run automatically** at startup, on navigation, when a tab opens, or on a timer.
- Default scope: **ungrouped, unpinned tabs in the current window**. Existing groups and pinned tabs remain untouched unless the user explicitly expands scope in a future enhancement.
- Gather tab titles/URLs and, when explicitly enabled and accessible, compact page excerpts to improve classification. State what data is being sent.
- AI returns a validated, structured proposal assigning each eligible tab ID to at most one group, with a short descriptive group name (target <= 28 characters) and one of Chrome's supported group colors.
- Create actual Helium/Chromium native tab groups using `tabs.group` and `tabGroups.update`; do not build a fake overlay-only grouping system.
- Prefer groups with at least two related tabs; unrelated tabs can remain ungrouped. Do not create arbitrary miscellaneous groups to force coverage.
- Keep original tab titles unchanged. Never close or discard tabs.
- Save a pre-operation snapshot of tab order, group membership, group title, group color, and collapsed state. Expose **Undo Tidy Tabs** for the latest operation. Restore the state as closely as the APIs permit and explain any conflicts caused by tabs changed since the snapshot.
- On malformed or failed AI output, apply **no partial grouping**. Only mutate tabs after the plan passes validation.

**Acceptance:** With 12 ungrouped, unpinned tabs, selecting Tidy Tabs yields coherent browser-native groups and names, preserves pinned/existing groups, and exposes a working best-effort Undo. Without clicking Tidy Tabs, grouping never happens.

### F03 — BYOK AI providers

**Requirements**

- Initial provider adapters: **OpenAI, Anthropic, Gemini, OpenRouter, Ollama**, and **custom OpenAI-compatible endpoint**.
- Allow provider choice, model ID, base URL where applicable, API key when applicable, temperature/token budget where supported, and a **Test Connection** action.
- Provide a single typed provider interface for chat/completions and structured responses, with per-provider serialization and response parsing.
- Use direct calls from the extension's privileged context where CORS and provider APIs permit; no vendor-operated relay.
- Support per-feature model overrides as a later enhancement; v1 uses one configurable default model unless feasibility suggests a simple override.
- Never expose API keys to webpage JavaScript, content-script messaging payloads, logs, telemetry, or export files. **Do not claim extension-local storage is encrypted.** Default to session-only credentials; offer persistent local storage only with explicit risk disclosure and extension-context-only storage access.
- Ollama operates locally if configured and reachable. Make clear that hosted providers receive selected page text when invoked.
- Invalid keys, quotas, model failures, and offline providers must yield actionable errors and must not alter tab state.

**Acceptance:** A user can select a provider, test a connection, run a page summary, switch providers, and repeat without reinstalling the extension or creating an account.

### F04 — Summarize and Ask on Page

**Requirements**

- User-initiated summary and freeform Q&A of the active page.
- Extract readable text, title, URL, headings, and relevant metadata on supported pages. Avoid navigation chrome, advertisements, hidden secrets, forms, and password fields.
- Output clear summaries and question answers grounded in extracted content; link answers to relevant headings/quotes where feasible; explicitly say when evidence is absent.
- Permit follow-up questions within a single session. Provide a clear “Forget this page conversation” control; no automatic permanent history.
- When page access is unavailable (internal pages, some PDFs, cross-origin frames, restricted sites), explain the limitation rather than inventing content.

**Acceptance:** On a supported article, Summarize Page generates a relevant summary; a factual follow-up uses article context. An unsupported page shows an explicit access error.

### F05 — Shift-hover link previews

**Requirements**

- When **Shift is held while hovering over an HTTP(S) link**, show a small summary card near the pointer after a short debounce (target 350–500 ms).
- Display linked page title, domain, 2–4 sentence AI summary, and Open Link action. Esc, pointer exit, or Shift release dismisses it.
- Fetch only as required, with explicit host permission/consent, and cap response size. Cache by normalized URL with TTL; never fetch every link on a page automatically.
- Treat signed-in pages, cross-origin blocks, paywalls, robots restrictions, and anti-bot pages as potentially unavailable; show title/metadata or “Preview unavailable” instead of fabricated content.
- Suppress on text inputs, editable areas, unsupported schemes, and extension/privileged pages.

**Acceptance:** Shift-hover over an accessible article link produces a grounded summary without creating a tab. Normal hover alone produces no network call or AI request.

### F06 — Cross-tab understanding

**Requirements**

- Explicit **Summarize Tabs** and **Ask Across Tabs** actions, initially defaulting to all accessible tabs in the current window. Offer selection/exclusion of individual tabs before reading their content.
- Extract content per eligible tab; mark discarded, restricted, timed-out, or otherwise unreadable tabs as skipped. Do not silently reload or activate them unless the user opts in.
- Generate a combined summary or answer with per-claim source URLs/tab titles, a list of included/skipped tabs, and a clear context-size cap.
- Chunk and map/reduce for long inputs; enforce token and estimated-cost ceilings. No claim of reading tabs whose content was inaccessible.

**Acceptance:** Summarizing five readable research tabs produces a coherent synthesis with clickable sources and a report of any skipped tabs.

### F07 — Instant Links-style navigation

**Requirements**

- Support a command such as `Find the official React docs` or `Instant Links: ...` that returns ranked, clickable search results and allows a one-action **Open Best Match**.
- **Do not trust model-invented URLs.** Candidate links must come from a real, configured search adapter/API or other verifiable source; LLM may rerank and explain candidates.
- Search adapter is separately configurable (may require its own key). If no search provider is configured, fall back to opening a conventional search-results page rather than pretending to have live search.
- Show destination URL/domain before navigating, block unsafe schemes, and avoid auto-opening multiple tabs without explicit confirmation.

**Acceptance:** With a search connector configured, the palette returns grounded candidate URLs and opens the chosen one. Without one, it offers an ordinary search-page fallback.

### F08 — Tidy Downloads (optional)

**Requirements**

- Feature is **off by default** and enabled explicitly in settings.
- At filename-determination time, suggest a concise filename based on existing filename, source URL/page title if available, file type, and MIME type. Do not claim full-file content analysis in v1.
- Preserve original file extension; normalize unsafe characters; avoid path traversal; respect duplicate-name conflict handling.
- `downloads.onDeterminingFilename` must invoke `suggest()` **exactly once**; use a bounded timeout (default 4 seconds) and fall back to the original name if AI is slow or fails.
- Do not rename previously saved files. Do not block downloads indefinitely. Disclose that metadata may be sent to the configured hosted AI provider when enabled.

**Acceptance:** With feature enabled, an ordinary download can receive a safer descriptive name without changing its extension. With feature disabled or on failure/timeout, the browser saves under its original suggested name without a prolonged block.

## 6. UX and interaction rules

- Palette is a compact, centered modal (Raycast/Arc-inspired, but original design) with command search, icon, keyboard hint, and contextual description.
- Tidy Tabs is prominently available from both the modal and extension toolbar. It applies on request; no unattended changes.
- Each AI feature has visible `idle → running → succeeded/failed` states with cancel where feasible.
- Provide optional consent/permissions prompts at the point of use, not unnecessary all-sites access at install.
- No AI request on ordinary browsing, apart from explicit Shift-hover and opt-in download renaming.
- Show source links and any skipped content; never represent model guesses as retrieved facts.
- UI should match Helium's light/dark theme and be usable with keyboard and screen reader.

## 7. Technical architecture

**Stack:** TypeScript; React or Preact for UI; Vite/WXT/Plasmo-style extension bundler (agent to choose following compatibility spike); Manifest V3; browser/Chrome extension APIs.

**Modules:**

```text
src/
  background/           # MV3 service worker, command dispatch, tab/download APIs
  content/              # palette mount, page extraction, Shift-hover listeners
  ui/                   # palette, preview card, settings, result views
  features/
    tidy-tabs/           # group proposal, validation, apply, snapshot/undo
    ask-page/            # extraction + grounded Q&A
    link-preview/        # URL retrieval, permission, caching
    cross-tab/           # selection, extraction, summarization
    instant-links/       # search adapter + result verification
    tidy-downloads/      # filename suggestion + deadline/fallback
  ai/                   # provider adapters, schema parsing, token budgets
  storage/              # settings, session secrets, caches
  shared/               # message contracts, types, validators
```

**Principles:**

- Background worker owns privileged APIs and outbound provider requests; content scripts render UI/extract sanctioned DOM content only.
- Use typed messages between content scripts and background, with explicit operation IDs and cancellation/timeout behavior.
- Treat website text as **untrusted data**; never allow prompt-injected page instructions to issue commands, exfiltrate secrets, or bypass user confirmation.
- Schema-validate all LLM actions, especially grouping and navigation, against current tab IDs, allowed browser APIs, and verified search results.
- Keep caching bounded and local. No hidden server-side dependency.

**Expected APIs:** `commands`, `tabs`, `tabGroups`, `scripting`, `storage`, `downloads`, and permission APIs. Use optional HTTP(S) host permissions where possible. Browser-internal pages and certain sites cannot host injected overlays.

## 8. Privacy, security, and permissions

- No analytics, tracking pixels, cookies sent to a project server, cloud sync, or mandatory sign-in.
- Display exactly what may go to a provider: page text, tab titles/URLs, link content, or download metadata depending on invoked feature.
- Restrict provider credentials to privileged extension contexts; set storage access level accordingly; clear session secrets on browser restart; provide a **Clear credentials and cache** action.
- Never collect form contents, password inputs, authentication tokens, browser cookies, or private browsing sessions without explicit added scope; private/incognito mode unsupported in v1.
- Request the least privileges feasible and provide a permissions explainer. Consider optional host permissions when the user invokes a feature on a site.
- Filter non-HTTP(S) links; reject `javascript:`, `file:`, `data:`, and browser-internal schemes for previews/navigation. Guard arbitrary remote fetch targets and redirects; do not access private network targets except an explicitly configured local Ollama endpoint.
- Package extension without remote executable code; apply a restrictive CSP; sanitize AI and webpage-derived content before rendering.
- Provide clear provider errors, rate limits, and cost controls. Do not persist raw page contents or AI conversations by default.

## 9. Nonfunctional requirements

| Area | Target |
| --- | --- |
| Palette | UI displayed within 200 ms under typical load, excluding provider calls |
| Local command/tab search | Interaction feedback within 100 ms for ordinary tab counts |
| Tidy Tabs | Typical 10–30 tab operation completes within 10 seconds, provider-dependent; no partial mutation |
| Hover previews | Debounce 350–500 ms; display loading state; stop unnecessary work when dismissed |
| Reliability | All AI operations have timeouts/retry guidance; fallback preserves user state |
| Accessibility | Full keyboard handling, focus restore, labeled controls, adequate contrast |
| Tests | Unit coverage of action validators and failure paths; browser integration smoke tests |
| Compatibility | Current stable Helium on macOS, tested with a loaded unpacked MV3 extension |

Timing targets are engineering goals, **not** promises about external AI latency.

## 10. Milestones and agent handoffs

**M0 — Compatibility spike / design decisions**

- Confirm extension loads in current Helium on macOS.
- Test whether `Cmd+K` can be captured globally/on normal sites, and document fallback.
- Verify native tab grouping, permissions, content-script injection, download naming, and provider API calls.
- Output: compatibility matrix, chosen bundler, proof-of-concept, revised risk log.

**M1 — Core MVP (P0)**

- Extension shell, toolbar action, `Cmd+K`/fallback palette, tab search.
- Settings, provider adapters, connection test, privacy disclosures.
- Manual Tidy Tabs, structured response validation, browser-native groups, Undo.
- Ask/Summarize current page.
- Output: installable unpacked build and working acceptance tests for F01–F04.

**M2 — Research features**

- Shift-hover link previews with cache and permission handling.
- Cross-tab summaries and source attribution.
- Output: acceptance tests for F05–F06 and skipped-tab handling.

**M3 — Navigation and downloads**

- Configurable search adapter and grounded Instant Links.
- Opt-in Tidy Downloads with bounded `suggest()` timing.
- Output: acceptance tests for F07–F08, failure/fallback tests.

**M4 — Stabilization and release**

- Security/privacy audit, permissions review, macOS Helium compatibility regression, keyboard accessibility, performance, docs, and packaged release artifacts.
- Output: reproducible build, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, test report and release notes.

**Parallel workstreams:** (a) UI/UX + command palette; (b) AI adapters/security; (c) tab grouping/undo; (d) page/link extraction; (e) search/download integrations; (f) E2E testing. Assign one integration owner for shared types and permissions.

## 11. Definition of done / end-to-end acceptance

1. In a fresh Helium profile, the unpacked extension installs and the user can configure a provider or local Ollama.
2. The modal opens via a working keyboard shortcut and the toolbar on supported pages, and remains keyboard navigable.
3. The user can manually group tabs, see named native groups, undo, and confirm that no automatic grouping or individual tab renaming occurs.
4. Page summaries and Q&A are grounded in accessible webpage text, with candid errors for inaccessible pages.
5. Shift-hover creates a link summary without opening a new tab; normal hover does not trigger AI.
6. Multiple tabs can be summarized with linked sources and explicit skipped-tab reporting.
7. Instant Links uses sourced candidates; without search configuration it falls back to normal search.
8. Optional download renaming preserves file extension and uses the original filename on timeout/failure.
9. Hosted API keys do not enter content scripts or logs; page content is transmitted only on disclosed user actions or enabled features.
10. All features have meaningful tests and documented limitations. No mandatory SaaS backend.

## 12. Risks and decisions

| Risk | Mitigation / decision |
| --- | --- |
| `Cmd+K` is reserved by Helium or a webpage | Best-effort capture on supported pages; extension command fallback; toolbar always works. Do not promise universal interception. |
| Link previews blocked by authentication or site rules | Permission-aware fetching, metadata-only or unavailable state, never fake summaries. |
| Many tabs exceed context budget | Per-tab limits, chunking, token/cost caps, visible included/skipped list. |
| Undo after other tab changes | Snapshot and best-effort restoration; warn if precise restore is impossible. |
| LLM assigns invalid tab IDs or malicious commands | Strict schema validation and allowed-operation list; no mutation before validation. |
| Download filename listener stalls saves | One bounded `suggest()` call; original-name fallback and regression tests. |
| Key storage or AI data exposure | Session-only default, least permissions, trusted-context access, disclosure. |
| Browser compatibility differs from Chrome | M0 spike on Helium; isolate API differences behind adapters. |
| Instant Links lacks reliable search source | Require explicit real search API; otherwise open standard search results. |

## 13. Success criteria

The project is successful when a Helium user can complete the primary Arc Max-inspired workflows from **one extension**, without compulsory subscriptions or automatic tab grouping. Primary indicators: manual grouping succeeds and is reversible; keyboard palette is reliable on supported sites; AI answers identify sources; and privacy/failure fallbacks work as specified.

No user telemetry is required to measure this: use local/manual acceptance testing and opt-in test data.

## 14. References for implementers

- Helium Browser, official: https://helium.computer/
- Chromium extension commands: https://developer.chrome.com/docs/extensions/reference/api/commands
- Chromium tabs grouping: https://developer.chrome.com/docs/extensions/reference/api/tabs
- Chromium tab group naming: https://developer.chrome.com/docs/extensions/reference/api/tabGroups
- Chromium download naming: https://developer.chrome.com/docs/extensions/reference/api/downloads
- Chromium script injection: https://developer.chrome.com/docs/extensions/reference/api/scripting
- Chromium storage: https://developer.chrome.com/docs/extensions/reference/api/storage
- Extension permission model: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions

---

**Implementation directive:** Respect the user's explicit decisions: **Tidy Tabs runs only upon request, names groups only, and never renames individual tabs.** Treat `Cmd+K` as a best-effort requirement with a fully functional fallback. Build a single Helium-compatible MV3 extension, not a browser fork.
