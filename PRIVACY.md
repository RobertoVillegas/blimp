# Blimp privacy policy

Effective November 8, 2026.

Blimp is a browser extension. It has no server, no account and no analytics. The developer never receives your data. This page lists everything Blimp reads, where it keeps it, and the only places it sends anything: services **you** configure, when **you** use the feature that needs them.

## What Blimp reads, and when

| Data | When | Why |
| --- | --- | --- |
| Titles and addresses of your tabs | When you open the ⌘K palette, run Tidy Tabs, Tidy Tab Titles or Summarize/Ask Across Tabs, and for auto-archive if you turn it on | To list, organize, name and archive tabs |
| Visible text of a page | When you run Summarize Page, Ask Page or Summarize/Ask Across Tabs on it | To answer about it |
| Text of a linked page | When you hold Shift over a link (if link previews are on), or when Browse for Me reads search results | To preview or answer |
| Text you selected | When you run Copy as Quote | To copy it |
| What's playing in a tab | When the palette opens (media controls) | To show and control it |
| A screenshot of the visible page | When you run Capture | To copy or save it |
| Your browsing history | Only when you run Recent Pages, and only if you turned it on | To list the pages you visited on a site |
| Download filename, type, address (without query strings) and page title | When a download starts, only if Tidy Downloads is on | To suggest a clearer name |
| Your unread Gmail messages (sender, subject, snippet) | When you run Unread Email, only if you turned Gmail on | To show them |
| Your calendar's events | When you run Upcoming Events, only if you saved a calendar address | To show them |
| GitHub issues and pull requests matching your searches, and RSS/Atom feeds you add | When Live Folders refresh, only for folders you added | To show them |

Blimp never reads form fields, password fields, cookies or private browsing sessions.

## Where it keeps data

Everything stays in your browser's extension storage on your device:

- Settings, AI profiles, Live Folders, the tab archive (30 days), renamed tab titles, and what the palette learned about the commands and results you use (clearable in Settings).
- API keys, your calendar address and your GitHub token are kept only until you quit the browser, unless you choose to keep them on the device. They are never shown to web pages.
- Page conversations and link previews are kept only for the browser session.

## Who receives data, and when

Only these services, and only when you use the feature that needs them:

| Service | What it receives | When |
| --- | --- | --- |
| The AI provider of the profile you configured (for example OpenAI, Anthropic, Google, DeepSeek, Mistral, OpenCode, OpenRouter, a local Ollama or your own server) | The data the command needs: tab titles and addresses, page text, your question, a download's details | When you run an AI command, use link previews, Instant Links, Browse for Me or Tidy Downloads |
| Your search provider (Brave Search API or your SearXNG) | Your search | When you use Instant Links or Browse for Me |
| The sites you preview or read | A normal request for the page, without your cookies | Link previews, Browse for Me |
| Gmail (mail.google.com) | A request for your unread feed, with your existing Gmail session | Unread Email |
| Your calendar host | A request for your calendar's iCal address | Upcoming Events |
| GitHub (api.github.com) and the feeds you add | Your searches, with your token; a request for each feed | Live Folders |
| GitHub (api.github.com) | A request for Blimp's public release list, nothing about you | Twice a day, only for copies not installed from the Chrome Web Store, and only if update checks are on |

Each provider's own privacy policy covers what it does with what it receives. Choose a local model (Ollama) if you don't want page text to leave your computer. Blimp only sends data over encrypted connections, except to services on your own computer (localhost).

Blimp does not sell or transfer data to anyone else, does not use it for advertising, credit or lending decisions, and does not let humans read it.

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use/), including the Limited Use requirements.

## Your control

Every optional feature is off until you turn it on. **Settings › Privacy › Clear credentials and cache** removes keys and session data; **Forget what the palette learned** removes its ranking data; removing the extension deletes everything it stored.

## Contact

Questions or concerns: open an issue at https://github.com/RobertoVillegas/blimp/issues, or report a vulnerability privately through the repository's Security tab.
