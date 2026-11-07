# Arc features: what's done

Every Arc feature we know of, from Arc's own docs and from the feature modules in the Arc 1.172 app, and where it stands here. Keep this list current when something ships.

- [x] Done in Blimp (version)
- [x] **Helium:** Helium already does it natively
- [~] Partly done, or done differently
- [ ] Not yet
- ✗ Not possible as an extension, or out of scope (reason given)

## Arc Max (AI)

- [x] Tidy Tabs: AI groups tabs into named tab groups (v0.1), with Undo, optionally into your existing groups (v0.3)
- [x] Tidy Tab Titles: short names for pinned tabs (v0.3.5), plus Rename Tab and Restore Tab Titles
- [x] Ask on Page (v0.1). Arc opened it with ⌘F; here it's in the ⌘K palette
- [x] Ask on Page quotes: every quote is checked against the page ("Not found on the page" otherwise), the answer's key words are bold, and Show on page selects the sentence (v0.5.0)
- [x] 5-second previews: Shift-hover link summaries (v0.2) with the page's image (v0.3.3)
- [x] 5-second previews as Arc's answer card: 3–8 word headline plus 2–4 labeled facts, and a blocked-page check (v0.5.0)
- [x] Hover previews without Shift on list sites (Hacker News, Google results, Reddit, X, GitHub, Lobsters), opt-in (v0.5.0)
- [x] Instant Links: real search results, AI picks the best one (v0.2)
- [x] Instant Links intents: navigate vs. search, images, news, maps, directions, flights, search inside a site, open several results with one click (v0.5.0)
- [x] Tidy Downloads: AI filenames before saving (v0.2)
- [x] Tidy Downloads with style examples and the source tab's title (v0.5.0)
- [x] Browse for Me: searches, reads the top results and answers with clickable numbered sources, in the palette (v0.5.0)
- [x] Summarize/Ask Across Tabs: the same over tabs you choose (v0.2)
- [x] ChatGPT in the command bar: Ask AI, type and press Tab, with follow-ups, using any provider (v0.5.0)

## Command bar and navigation

- [x] ⌘K palette with commands and open tabs (v0.1)
- [x] Search tabs by title or URL and jump to them (v0.1)
- [x] Picking the command whose name matches what you typed (v0.3.5)
- [x] Arc's ranking: empty palette shows your most recently used tabs first, commands by how much you use them, and what you picked for a query comes first next time; all on device, with a Forget button (v0.10.0)
- [x] Copy URL, Copy as Markdown Link, Copy as Quote (selected text with a link back) (v0.5.0)
- [x] **Helium:** address bar, search engines, history

## Little Arc

- [x] Little Blimp window: a small window without a tab strip for a quick search or address, opened with ⌥⇧N or from the palette (v0.7.0). Arc used ⌥⌘N; Chromium doesn't let extensions use ⌘+⌥ shortcuts
- [x] "Open in…": Open in Main Window moves the page into your main window as it is, scroll and typing included (v0.7.0)
- [ ] Links from other apps open in Little Arc
- [~] Open a link in Little Arc: right-click › Open Link in Little Blimp (v0.7.0). A modifier-click isn't there yet
- [x] Remember the Little Arc window size and position, falling back to centered when that spot is off screen (v0.7.0)
- [x] Close all Little Arc windows, from the palette or the toolbar icon's menu (v0.7.0)
- [ ] Archive old Little Arcs after a while

## Tabs, sidebar and organization

- [x] **Helium:** pinned tabs in the sidebar
- [x] **Helium:** vertical tabs sidebar
- [x] **Helium:** tab groups (our stand-in for Arc's folders)
- [x] **Helium:** split view
- [x] **Helium:** profiles
- [x] **Helium:** favorites / pinned grid: Helium's pinned tabs cover it
- ✗ A second, Blimp-made tab sidebar: decided against (Nov 2026). Helium's sidebar already lists tabs and pinned tabs, and an extension's side panel would be a second column next to it. Blimp's extras (media, peeks, Live Folders, archive) live in the ⌘K palette instead
- [~] Spaces: tab groups and profiles cover most of it
- ✗ Changing Helium's sidebar itself: extensions can't, and Helium doesn't accept AI-written patches
- [x] Auto-archive: close tabs untouched for 12 h / 24 h / 7 d / 30 d, never pinned, grouped, active or playing ones, with ⌘K › Archived Tabs to reopen them for 30 days (v0.8.0)
- [ ] Air Traffic Control: rules that send links from other apps to a specific window or tab group
- [x] Live Folders: GitHub PRs and issues (review requests, mine, assigned, or any search) and RSS/Atom feeds, refreshed every 30 minutes with new items marked, in ⌘K › Live Folders (v0.9.0)
- [x] Recent pages preview: ⌘K › Recent Pages lists the last pages you visited on the current site or a pinned tab's site, from history (opt-in) (v0.10.0)

## Favorites previews and peeks

- [x] Gmail: unread email (v0.4.0), in the palette (Arc showed it on hovering a favorite)
- [x] Google Calendar: upcoming events with Join (v0.4.0), in the palette
- [x] Unread counts kept in renamed tab titles (v0.3.5)

## Media

- [x] Media controls / mini player: Now playing in the palette (v0.3.9) with play/pause, previous/next on known players, mute, go to tab, picture in picture
- [ ] Mic and camera toggles for Google Meet in the mini player
- [x] Picture in Picture from the palette (v0.3.8)
- [~] Auto picture in picture when leaving a tab (v0.4.0): works only for audible videos on sites allowed in the browser's automatic picture-in-picture settings (or that it has seen you watch a lot); Settings › Video links there
- [x] **Helium:** native picture-in-picture window, movable to any corner

## Customization

- [ ] Boosts: custom CSS, colors and fonts per site
- [ ] Zap: click page elements to hide them for good
- ✗ Boosts with JavaScript: even Arc refused to share those; we'd keep it CSS-only
- [x] **Helium:** themes and colors

## Capture and notes

- [x] Capture: drag over part of a page (or Enter for the whole view), copied to the clipboard with a Save button (v0.8.0)
- [ ] Easel: a whiteboard of captures and live page snippets (large; later, if ever)
- [ ] Notes (Arc's documents)

## Other

- [x] **Helium:** translate, share, site settings (Site Control Center), downloads
- ✗ Arc sync, accounts, membership: there's no backend by design
- ✗ Sound effects: not worth it
