# Contributing

Thanks for looking. Issues and pull requests are welcome.

## Setup

You need Node 24 and pnpm (the version is pinned in `package.json`).

```sh
pnpm install
pnpm dev          # WXT watch mode in a throwaway Chromium profile
```

To try a build in Helium, run `pnpm build` and load `.output/chrome-mv3` with **Load unpacked**.

## Before you open a pull request

```sh
pnpm check        # typecheck, unit tests, production build
pnpm test:e2e     # loads the extension in Playwright Chromium against a mock provider
```

Both run in CI. `pnpm build:e2e` makes two test builds: the usual one, with access only to the local fixture server, and `e2e-capture`, with `<all_urls>` standing in for the activeTab grant that only a real shortcut or toolbar click gives, used by the Capture tests. If you change something visible in the README screenshots, run `pnpm screenshots` and commit the new images.

## How the code is organized

- The background worker (`src/background`, `src/features/*/index.ts`) owns every privileged call: tabs, groups, scripting, downloads, and all network requests to AI and search providers.
- Content scripts (`src/entrypoints/*.content.*`) render UI and read page text. They never see API keys and never call providers directly.
- UI talks to the worker through the typed messages in `src/shared/messages.ts`. Every message is validated with zod when it arrives.
- Pure logic (plan validation, packing, filename sanitizing, URL guards) lives in small modules with unit tests next to them. Code that talks to the browser goes through ports or injectable `fetch` so it can be tested without one.

## Rules that matter

These come from the [product spec](docs/PRD.md) and aren't negotiable in a PR:

- Nothing runs on its own. Tidy Tabs and every AI command run only when the user asks.
- Never close or discard a user's tab, and never rename the user's own tab groups. Tabs are renamed only by an explicit command, and Restore Tab Titles must always undo it.
- Treat page text and model output as untrusted. Validate before acting, and render model output as text.
- Ask for permissions at the point of use, not at install.
- Say what will be sent where before sending it.

## Releases

Bump `version` in `package.json`, merge to `main`, then push a matching tag (`v0.4.0`). The Release workflow checks the tag matches, builds the zip, writes `SHA256SUMS` and publishes the GitHub release (never as a pre-release: `/releases/latest` ignores those). Installed copies show an update notice within 12 hours.
