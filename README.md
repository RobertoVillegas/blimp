<p align="center">
  <img src="docs/images/icon.png" width="96" height="96" alt="">
</p>

<h1 align="center">Helium Max</h1>

<p align="center">
  The Arc Max features I missed, rebuilt as one extension for <a href="https://helium.computer/">Helium</a>.<br>
  ⌘K palette · Tidy Tabs · ask the page you're reading · your own AI key
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
- Pinned tabs and groups you made yourself are left alone.
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

### AI profiles

<img src="docs/images/profiles-palette.png" width="520" align="right" alt="Typing 'profile' in the palette lists OpenCode Go (active), DeepSeek, Mistral – DeepSeek and Anthropic">

Each profile is a provider plus a model plus a key. On first run you get one for OpenAI, Anthropic, Gemini, DeepSeek, Mistral and OpenCode Go, so you only paste a key. Add as many more as you like, for example two Mistral profiles pointing at different models.

Type `profile` in the palette to switch which one is active.

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

<details>
<summary>What Settings looks like</summary>
<br>
<img src="docs/images/settings.png" width="520" alt="Settings page with the profile list (OpenCode Go active, DeepSeek, Mistral – DeepSeek, Anthropic) and the OpenCode Go profile form">
</details>

To update, download the new zip, replace the folder's contents, and click the reload arrow on the extension's card.

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
| OpenCode Go | `opencode.ai/zen/go/v1` | Your Go subscription key. Only models Go serves over Chat Completions are listed (DeepSeek, GLM, Kimi, MiMo and others). To use DeepSeek there, enable the **Global** region in your OpenCode workspace privacy settings. |
| OpenRouter | `openrouter.ai/api/v1` | Add it with **Add profile**. |
| Ollama | `localhost:11434` | Runs on your machine. Start it with `OLLAMA_ORIGINS="chrome-extension://*" ollama serve`. |
| Custom | anything | Any server that speaks the OpenAI Chat Completions API. |

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

| You run | The active profile's provider receives |
| --- | --- |
| Searching in the palette | Nothing |
| Tidy Tabs | Titles and URLs of the ungrouped, unpinned tabs in the window |
| Summarize Page, Ask Page | Visible text of the current page, and your questions |
| Just browsing | Nothing |

The palette footer tells you which provider a command will use before you run it. Helium Max asks for no site access when you install it. The palette gets into a page only after you press the shortcut or the toolbar button, and the extension asks for an API origin only when you save a profile that uses it.

## Status

This is an early build. Everything below is tested in Chromium; **I haven't run it in Helium itself yet**. The checklist for that is in [`docs/compatibility.md`](docs/compatibility.md). The provider adapters are unit-tested against each API's request format but have only been run against a local mock, not real keys.

| | Feature | |
| --- | --- | --- |
| ✅ | ⌘K command palette | M1 |
| ✅ | Tidy Tabs with Undo | M1 |
| ✅ | AI profiles (bring your own key) | M1 |
| ✅ | Summarize and Ask Page | M1 |
| ⏳ | Shift-hover link previews | M2 |
| ⏳ | Summarize and ask across tabs, with sources | M2 |
| ⏳ | Instant Links (search results you can open in one step) | M3 |
| ⏳ | Tidy Downloads (better filenames, opt-in) | M3 |

[Jev](docs/jev.md), TypeSafe's decision model, was looked at and parked for now.

## Development

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
  entrypoints/    background worker, overlay content script, palette popup, settings page
  background/     message router, palette opener (overlay or popup)
  features/
    tidy-tabs/    prompt, plan validation, apply, snapshot and undo
    ask-page/     in-page text extraction, grounded Q&A
  ai/             provider presets, wire adapters, model lists, errors
  storage/        settings and profiles, per-profile keys
  ui/palette/     the palette, shared by the overlay and the popup
  shared/         message contracts, types, URL guards
e2e/              Playwright tests and the README screenshot script
```
