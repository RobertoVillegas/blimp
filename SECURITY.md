# Security

Helium Max reads web pages and holds AI API keys, so it's built to keep both away from websites. This file describes what it protects, what it doesn't, and how to report a problem.

## Reporting a vulnerability

Use **Report a vulnerability** on the repository's [Security tab](https://github.com/RobertoVillegas/helium-max/security). That opens a private advisory only the maintainer can see. Please don't open a public issue for a vulnerability.

Include the version (Settings › Updates shows it), the browser and version, and the steps to reproduce.

## What Helium Max protects

**API keys stay in extension contexts.** Keys are stored per profile in `storage.session` (cleared when the browser quits, and restricted to `TRUSTED_CONTEXTS` so content scripts can't read it) or, if you choose, in the extension's own IndexedDB. Webpages and content scripts never receive a key; every provider request is made by the background worker or the settings page. Provider error messages are scanned for key-shaped strings before they're shown. An e2e test checks that a content script can't read session storage.

**Page text is untrusted.** Everything taken from a page, a tab, a linked page, a search result or a download is wrapped in tags and the model is told never to follow instructions in it. Nothing the model returns can trigger an action on its own:

- Tidy Tabs only applies a plan that passes validation against the real tab IDs and group IDs; otherwise nothing changes.
- Instant Links only opens a URL that came back from the search provider in the last search, and only http(s).
- Tidy Downloads filenames are sanitized: no paths, no `..`, no control or bidi characters, no reserved names, and the original extension is kept.
- Model output is rendered as text. No HTML or markdown links are interpreted.

**Least privilege.** The install asks for no site access. The palette uses `activeTab`. Provider origins, tab sites, all-sites access for link previews, and the `downloads` permission are requested only when you use the feature that needs them.

**Link previews can't be used to probe your network.** Previews are fetched without cookies, capped at 1.5 MB and 8 seconds, and refused for loopback, private, link-local, CGNAT (including Tailscale) and local-only hostnames, including when a public URL redirects there. The hover script ignores synthetic events, so a page can't fake Shift-hover to spend your tokens, and the preview card lives in a closed shadow root the page can't read.

**No backend.** There is no Helium Max server, account or telemetry. The only network calls are to the AI provider and search provider you configure, the sites whose pages you ask about, and, unless you turn it off, a twice-daily check of this repository's GitHub releases.

## What it doesn't protect against

- **Your AI provider sees what you send it.** Use a local model (Ollama, or a custom endpoint on localhost) if that's a problem.
- **Keys kept across restarts are not encrypted.** Anyone with access to your browser profile on disk can read them. The default keeps them only for the session.
- **A malicious or compromised browser extension**, or malware on your machine, can read what Helium Max can read.
- **Prompt injection can still make an answer wrong.** It can't make the extension take an action the validation above doesn't allow, but a page can still lie to the model. Answers cite their sources so you can check.

## Extension packaging

The extension ships without remote code. Extension pages use a `script-src 'self'` content security policy, and the release zip is built by GitHub Actions from the tagged commit.
