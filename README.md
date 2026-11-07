<p align="center">
  <img src="docs/images/icon.png" width="96" height="96" alt="">
</p>

<h1 align="center">Helium Max</h1>

<p align="center">
  The Arc Max features I missed, rebuilt as one extension for <a href="https://helium.computer/">Helium</a>.<br>
  ⌘K palette · Tidy Tabs · ask a page or a whole window of tabs · Shift-hover previews · your own AI key
</p>

<p align="center">
  <a href="https://github.com/RobertoVillegas/helium-max/releases/latest"><strong>Download the latest build</strong></a>
  ·
  <a href="docs/PRD.md">Product spec</a>
  ·
  <a href="docs/compatibility.md">Compatibility notes</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/palette-dark.png">
    <img src="docs/images/palette.png" width="720" alt="The Helium Max command palette open over an article, listing Tidy Tabs, Summarize Page, Ask Page and open tabs">
  </picture>
</p>

When I moved from Arc to Helium, the part I kept reaching for was Arc Max: tidy my tabs, tell me what this page says, let me do it from the keyboard. Helium Max puts those back as one Manifest V3 extension.

There's no Helium Max server and no account. Requests go from your browser straight to the AI provider you configure, with your key, and only when you run a command.

Not affiliated with Helium or The Browser Company.

## What it does

### ⌘K palette

Press ⌘K on any page to search commands and your open tabs. Type part of a tab's title and press Enter to jump to it. Searching never calls the AI. If Helium keeps ⌘K for itself, use ⇧⌘K or the toolbar button. On pages extensions can't touch, like `helium://` pages and the Web Store, the palette opens as a popup instead.

### Tidy Tabs

<img src="docs/images/tidy-tabs.png" width="520" align="right" alt="Tidy Tabs result: PHP docs & CVEs, Madrid trip and React groups, one tab left ungrouped, and an Undo button">

Run **Tidy Tabs** and the model reads your tab titles and URLs. It invents group names that fit what you have open, like "PHP docs & CVEs" or "Madrid trip", and Helium Max turns them into real tab groups.

- It only runs when you ask. Never on a timer, never when a tab opens.
- Pinned tabs and groups you made yourself are left alone. If you'd like new tabs to join your existing groups instead (a new PHP tab into your "PHP" group), turn on **Also add tabs to groups I already have** in Settings. Your groups keep their names and colors, and Undo takes the added tabs back out.
- Tabs that don't fit anywhere stay ungrouped. There's no "Misc" group.
- It names groups. It never renames, closes or discards a tab.
- If the model returns anything that doesn't match your real tabs, nothing changes.
- **Undo Tidy Tabs** puts every tab back where it was and tells you about tabs that moved in the meantime.

<br clear="right">

### Summarize and Ask Page

<img src="docs/images/ask-page.png" width="520" align="right" alt="A summary of a CVE page with bullet points, followed by the question 'How do I fix it?' and an answer citing the Remediation section">

**Summarize Page** gives you the gist of the article you're on. **Ask Page** answers questions from it, and you can keep asking follow-ups. The model is told to say when the page doesn't contain the answer instead of guessing.

It only reads text you can see in the article. It skips menus, footers, hidden elements and forms, and it never reads password fields or what you typed into a form. Press **Forget this page conversation** to drop it, or quit the browser.

<br clear="right">

### Ask across tabs

<img src="docs/images/cross-answer.png" width="520" align="right" alt="An answer to 'Is my PHP 8.2 server affected?' built from three tabs, with numbered citation chips after each claim and a Sources list">

**Summarize Tabs** and **Ask Across Tabs** work over several tabs at once. You pick the tabs first; nothing is read until you press the button. The answer puts a numbered chip after each claim, and clicking a number takes you to that tab.

Tabs that can't be read are listed under **Skipped** with the reason: browser pages, sites you haven't given access to, and sleeping tabs unless you tick **Wake sleeping tabs**, which loads them in the background without switching to them. When there's more text than fits in one request, it summarizes in batches first and then combines them, with a cap so a big window can't run up your bill.

<details>
<summary>Picking the tabs</summary>
<br>
<img src="docs/images/cross-select.png" width="520" alt="Ask across tabs: a question field and a checklist of open tabs with three PHP tabs selected">
</details>

<br clear="right">

### Shift-hover link previews

<img src="docs/images/link-preview.png" width="520" align="right" alt="A preview card above a link, with the page title and a three-sentence summary of the linked page">

Hold Shift over a link and a card tells you what's on the other side, without opening a tab. This is off until you turn it on in Settings, because it needs access to the sites you visit.

The linked page is downloaded without your cookies, so anything behind a sign-in shows as unavailable instead of a made-up summary. Hovering without Shift sends nothing, and holding Shift while you type in a field doesn't trigger it either.

<br clear="right">

### Instant Links

<img src="docs/images/instant-links.png" width="520" align="right" alt="Search results for 'download latest php' with the php.net downloads page marked Best match and a one-line reason">

Type what you want, like "download latest php", then pick **Instant Links** (or the "Instant Links: …" row at the bottom of the palette). The results come from a real search engine, [Brave Search API](https://brave.com/search/api/) or your own [SearXNG](https://docs.searxng.org/), and the AI only picks the best match. Every URL is shown before you open it, and the extension refuses to open anything that wasn't in the results.

With no search provider set up, it hands the query to your browser's normal search engine instead of guessing a URL.

<br clear="right">

### Tidy Downloads

Off by default. When it's on, each download gets a clearer name before it's saved: `inv_8812.pdf` becomes `Acme invoice 8812.pdf`. The extension never changes, the file's contents are never read, and if the AI takes more than 4 seconds the browser's own name is used. Files you already downloaded are left alone.

### AI profiles

<img src="docs/images/profiles-palette.png" width="520" align="right" alt="Typing 'profile' in the palette lists OpenCode Go (active), DeepSeek, Mistral – DeepSeek and Anthropic">

Each profile is a provider plus a model plus a key. On first run you get one for OpenAI, Anthropic, Gemini, DeepSeek, Mistral and OpenCode Go, so you only paste a key. Add as many more as you like, for example two Mistral profiles pointing at different models.

Type `profile` in the palette to switch which one is active. Under **Models per feature** in Settings you can also give a feature its own profile, say a fast, cheap model for link previews and filenames and a stronger one for answers across tabs.

<br clear="right">

## Install

You don't need Node to try it.

1. Download `helium-max-<version>-chrome.zip` from the [latest release](https://github.com/RobertoVillegas/helium-max/releases/latest) and unzip it somewhere you'll keep it. Helium loads the extension from that folder, so don't delete it.
2. In Helium, open `helium://extensions` (`chrome://extensions` also works) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder, the one with `manifest.json` in it.
4. Settings opens by itself. Pick a profile, paste your key, then:
   - **Load models** to see which model IDs your key can use, and pick one.
   - **Save and use**. Helium asks to let the extension reach that provider's API; allow it.
   - **Test connection**. You should get "Connected".
5. Open any article and press ⌘K.
6. Optional, further down in Settings: turn on **Link previews** and **Tidy Downloads**, and set up a search provider for **Instant Links**.

<details>
<summary>What Settings looks like</summary>
<br>
<img src="docs/images/settings.png" width="520" alt="Settings page with the profile list (OpenCode Go active, DeepSeek, Mistral – DeepSeek, Anthropic) and the OpenCode Go profile form">
</details>

### Updating

An extension loaded from a folder can't update itself, so Helium Max tells you when there's a new release: a ↑ on the toolbar icon, a notice at the top of the palette, and steps in Settings › Updates. It checks this project's GitHub releases twice a day; you can turn that off in Settings.

1. Download [helium-max-chrome.zip](https://github.com/RobertoVillegas/helium-max/releases/latest/download/helium-max-chrome.zip) (always the newest).
2. Unzip it and copy everything into your Helium Max folder, replacing the old files.
3. Helium Max notices the new version and reloads itself within a minute, or press **Reload Helium Max** in Settings › Updates.

Profiles and settings stay. Keys you kept only for the session need to be entered again. Keep **Developer mode** on: with it off, Helium disables folder extensions when they reload.

> [!NOTE]
> Keys are kept only until you quit the browser, unless you choose **On this device across restarts** in Settings. That option stores them unencrypted in the extension's own storage, which webpages can't read but anyone with your browser profile on disk can.

## Providers

| Profile | Base URL | Notes |
| --- | --- | --- |
| OpenAI | `api.openai.com/v1` | |
| Anthropic | `api.anthropic.com/v1` | |
| Google Gemini | `generativelanguage.googleapis.com/v1beta` | |
| DeepSeek | `api.deepseek.com` | |
| Mistral AI | `api.mistral.ai/v1` | Mistral also hosts DeepSeek and other third-party models. **Load models** shows the IDs your key can use. |
| OpenCode Go | `opencode.ai/zen/go/v1` | Your Go subscription key. Pick a model from **Load models** and the right API is set for you: Chat Completions (DeepSeek, GLM, Kimi, MiMo), Anthropic Messages (Claude, Qwen, MiniMax) or OpenAI Responses (GPT, Grok). Gemini models in Go aren't supported yet. To use DeepSeek there, enable the **Global** region in your OpenCode workspace privacy settings. |
| OpenRouter | `openrouter.ai/api/v1` | Add it with **Add profile**. |
| Ollama | `localhost:11434` | Runs on your machine. Start it with `OLLAMA_ORIGINS="chrome-extension://*" ollama serve`. |
| Custom | anything | Any server that speaks OpenAI Chat Completions, OpenAI Responses or Anthropic Messages; pick which under **API**. |

If a model rejects a setting (newer OpenAI and other reasoning models refuse `temperature`, some servers refuse JSON mode), Helium Max retries once without it.

## Keyboard

| Keys | Does |
| --- | --- |
| ⌘K | Open or close the palette |
| ⇧⌘K | Same, for when ⌘K is taken |
| ↑ ↓ | Move through results |
| Enter | Run the command or switch to the tab |
| Esc | Back, then close |

Change them, or bind Tidy Tabs to its own shortcut, at `chrome://extensions/shortcuts`.

## What gets sent, and when

| You run | The provider of the profile that feature uses receives |
| --- | --- |
| Searching in the palette | Nothing |
| Tidy Tabs | Titles and URLs of the ungrouped, unpinned tabs in the window |
| Summarize Page, Ask Page | Visible text of the current page, and your questions |
| Summarize Tabs, Ask Across Tabs | Visible text of the tabs you tick, and your question |
| Shift-hover a link (if turned on) | Text of the linked page, downloaded without your cookies |
| Instant Links | Your query goes to the search provider; its results and your query go to the AI |
| A download starts (if Tidy Downloads is on) | Filename, file type, the address without query strings, and the page title |
| Just browsing | Nothing |
| Twice a day (unless turned off) | GitHub's public API is asked for this repository's releases; nothing about you is sent |

The palette footer tells you which provider a command will use before you run it. Helium Max asks for no site access when you install it. The palette gets into a page only after you press the shortcut or the toolbar button. Everything else is asked for when you use it: an API origin when you save a profile, a site when you include one of its tabs, all sites only if you turn on link previews, and the downloads permission only for Tidy Downloads.

Previews never fetch local addresses (`localhost`, `192.168.x.x`, `*.local`, Tailscale's `100.64.0.0/10` and so on), so a webpage can't use the extension to poke at your network.

## Status

This is an early build. It loads and runs in Helium; everything below is tested end to end in Chromium against a mock provider. The Helium checklist is in [`docs/compatibility.md`](docs/compatibility.md). The provider adapters are unit-tested against each API's request format but haven't been run against every real provider.

| | Feature | |
| --- | --- | --- |
| ✅ | ⌘K command palette | M1 |
| ✅ | Tidy Tabs with Undo | M1 |
| ✅ | AI profiles (bring your own key) | M1 |
| ✅ | Summarize and Ask Page | M1 |
| ✅ | Shift-hover link previews | M2 |
| ✅ | Summarize and ask across tabs, with sources | M2 |
| ✅ | Instant Links (search results you can open in one step) | M3 |
| ✅ | Tidy Downloads (better filenames, opt-in) | M3 |
| ✅ | Update notice, reloads itself after you copy a new build in | v0.3 |
| ✅ | Tidy into existing groups, wake sleeping tabs, a model per feature | v0.3 |
| ✅ | OpenCode Go models on Anthropic Messages and OpenAI Responses | v0.3 |

[Jev](docs/jev.md), TypeSafe's decision model, was looked at and parked for now.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the code is organized, and [SECURITY.md](SECURITY.md) for the threat model and how to report a vulnerability.

```sh
pnpm install
pnpm dev           # watch mode in a throwaway Chromium profile
pnpm check         # typecheck, unit tests, production build
pnpm test:e2e      # loads the extension in Playwright Chromium against a mock provider
pnpm screenshots   # regenerates the images in this README
pnpm zip           # .output/helium-max-<version>-chrome.zip
```

Pushing a `v*` tag that matches `package.json` builds the zip and attaches it to a GitHub release.

Built with [WXT](https://wxt.dev), React and TypeScript. The background service worker owns every privileged call: tabs, groups, page reading and provider requests. The palette is a React app that runs either inside a shadow root on the page or as an extension popup, and talks to the worker through typed messages.

```text
src/
  entrypoints/        background worker, palette overlay, hover script, palette popup, settings, grant page
  background/         message router, palette opener (overlay or popup)
  features/
    tidy-tabs/        prompt, plan validation, apply, snapshot and undo
    ask-page/         in-page text extraction, grounded Q&A
    cross-tab/        tab picking, batching, cited synthesis
    link-preview/     private-network guard, capped fetch, cache, hover script registration
    instant-links/    Brave and SearXNG adapters, ranking, open-only-real-results
    tidy-downloads/   safe filenames, onDeterminingFilename with a 4 s deadline
  ai/                 provider presets, wire adapters, model lists, errors
  storage/            settings and profiles, per-profile keys
  ui/palette/         the palette, shared by the overlay and the popup
  shared/             message contracts, types, URL guards, citations
e2e/                  Playwright tests and the README screenshot script
```
