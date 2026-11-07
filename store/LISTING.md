# Chrome Web Store submission

Everything to paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), and what to do first.

## Before the first submission (you)

1. Sign in to the Developer Dashboard with the Google account that will own Blimp, pay the one-time $5 fee, and turn on 2-step verification for that account.
2. Declare **non-trader** (free, personal project) when asked.
3. **New item → upload** `blimp-<version>-chrome.zip` from the latest GitHub release.
4. Fill in the fields below, set **Visibility: Unlisted**, and submit for review.
5. Optional, for automatic uploads on every release: create OAuth credentials for the Chrome Web Store API ([guide](https://developer.chrome.com/docs/webstore/using-api)) and add these repository secrets: `CWS_EXTENSION_ID`, `CWS_PUBLISHER_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`. Without them the release workflow skips the upload.

## Store listing

**Name:** Blimp

**Summary (132 characters max):** A ⌘K command bar for Helium and Chrome: AI page answers, Tidy Tabs, link previews, media controls and more. Your own AI key.

**Category:** Productivity › Tools

**Language:** English

**Description:**

Blimp is a command bar for your browser. Press ⌘K on any page and everything is a few keystrokes away: your tabs, the commands below, and the things you use most. It learns which ones those are, on your device.

Bring your own AI. Blimp works with OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, OpenCode, OpenRouter, a local Ollama or any OpenAI-compatible server, with your own key. There's no Blimp server, account or telemetry.

In the command bar:
• Ask Page and Summarize Page: answers quote the page, and every quote is checked against it.
• Ask Across Tabs: one answer from the tabs you pick, with numbered sources.
• Ask AI and Browse for Me: ask anything, or let it search, read the top results and answer with sources.
• Tidy Tabs: your AI groups the tabs in a window into named tab groups. Undo puts everything back.
• Tidy Tab Titles and Rename Tab: short names for pinned tabs, always reversible.
• Instant Links: open the right result for "the official React docs" or "directions to the airport", from a real search engine.
• Now playing: play, pause, skip and mute whatever is playing in any tab, or float the video in picture in picture.
• Little Blimp: a small window for a quick lookup.
• Capture, Copy as Markdown, Copy as Quote, Recent Pages, Archived Tabs, Live Folders for GitHub and RSS, and peeks at unread Gmail and upcoming events.

Optional, off until you turn them on: hold Shift over a link for a short preview, close tabs you haven't used in a while, and suggest clearer names for downloads.

Nothing runs on its own. Blimp only reads a page, or sends anything to your AI provider, when you run a command, and the command bar tells you which provider it will use first. All data stays in your browser.

Built for the Helium browser; works in Chrome and other Chromium browsers. Open source: https://github.com/RobertoVillegas/blimp

**Images:** `store/screenshot-1.png` … `screenshot-5.png` (1280×800), small promo tile `store/promo-small-440x280.png`, icon is in the package.

**Homepage:** https://github.com/RobertoVillegas/blimp

**Support:** https://github.com/RobertoVillegas/blimp/issues

## Privacy practices tab

**Single purpose:**

Blimp is a keyboard command bar (⌘K) for the browser. Every feature is a command in that bar that acts on the user's tabs and pages: searching and switching tabs, organizing and renaming them, answering questions about pages with the user's own AI provider, controlling media playing in tabs, and opening links and results.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| activeTab | The command bar opens as an overlay on the current page when the user presses ⌘K or clicks the toolbar button, and reads that page only when the user runs a page command (summarize, ask, capture, copy). |
| scripting | Injects the command bar into the current tab on the user's shortcut, reads page text for page commands the user runs, controls media playback, and keeps a tab's custom name when the user renamed it. |
| tabs | Lists and searches the user's tabs in the command bar, switches to them, and reads tab titles and addresses for Tidy Tabs, Archived Tabs and the media controls. |
| tabGroups | Tidy Tabs creates and names native tab groups, and Undo restores them. |
| storage | Saves settings, AI profiles, the tab archive and Live Folders locally. API keys are kept in session storage by default. |
| alarms | Refreshes Live Folders, runs auto-archive when the user enabled it, and checks for updates on non-store installs. |
| contextMenus | Adds "Open Link in Little Blimp" to the link menu and Little Blimp actions to the toolbar button's menu. |
| search | When no search provider is configured, Instant Links hands the query to the user's own default search engine instead of guessing a URL. |
| downloads (optional) | Requested only when the user turns on Tidy Downloads, to suggest a clearer filename before a download is saved. |
| history (optional) | Requested only when the user turns on Recent Pages, to list the pages they visited recently on a site. |
| Host permissions (optional) | None at install. Requested at the point of use: the AI provider's API origin when the user saves a profile; a site's origin when the user includes its tabs in Ask Across Tabs; mail.google.com for the Gmail peek; api.github.com for GitHub Live Folders; and all sites only if the user turns on link previews or automatic picture in picture. |

**Remote code:** No. All code is in the package. Network requests go only to services the user configured and return data, never code.

**Data usage** (check these):

- Personally identifiable information: no.
- Health, financial, authentication information: **Authentication information: yes** (the user's own API keys and tokens, stored locally, sent only to the matching service).
- Personal communications: **yes** (only if the user turns on the Gmail peek: sender, subject and snippet of unread mail, shown locally, never sent anywhere else).
- Location: no.
- Web history: **yes** (only with Recent Pages enabled, read locally).
- User activity: no.
- Website content: **yes** (page text the user asks about, sent to the user's chosen AI provider).

Certify all three: no selling or transferring data to third parties outside the approved use cases; no use or transfer for purposes unrelated to the single purpose; no use for creditworthiness or lending.

**Privacy policy URL:** https://github.com/RobertoVillegas/blimp/blob/main/PRIVACY.md

## Notes for the reviewer

Blimp needs no account. To try it: press ⌘K (or click the toolbar icon) on any page; searching tabs and most commands work without AI. AI commands need a provider key in Settings (OpenAI, Anthropic, Gemini, DeepSeek, Mistral, OpenRouter) or a local Ollama at http://localhost:11434. Optional features (link previews, auto-archive, Tidy Downloads, peeks, Live Folders, Recent Pages) are off by default and request their permission only when turned on in Settings.
