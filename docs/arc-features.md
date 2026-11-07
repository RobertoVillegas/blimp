# Arc features: what's done

Every Arc feature we know of, from Arc's own docs and from the feature modules in the Arc 1.172 app, and where it stands here. Keep this list current when something ships.

- [x] Done in Helium Max (version)
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
- [x] Copy URL, Copy as Markdown Link, Copy as Quote (selected text with a link back) (v0.5.0)
- [x] **Helium:** address bar, search engines, history

## Little Arc

- [ ] Little Arc window: a small, simple window for quick searches and one-off pages, opened with its own shortcut
- [ ] "Open in…": move the page from Little Arc to the main window
- [ ] Links from other apps open in Little Arc
- [ ] Open a link in Little Arc by clicking it with a modifier key
- [ ] Remember the Little Arc window size
- [ ] Close or show all Little Arc windows
- [ ] Archive old Little Arcs after a while

## Tabs, sidebar and organization

- [x] **Helium:** pinned tabs in the sidebar
- [x] **Helium:** vertical tabs sidebar
- [x] **Helium:** tab groups (our stand-in for Arc's folders)
- [x] **Helium:** split view
- [x] **Helium:** profiles
- [~] Favorites grid: Helium's pinned tabs cover it. A separate cross-window favorites grid isn't possible in Helium's sidebar from an extension
- [~] Spaces: tab groups and profiles cover most of it
- ✗ Changing Helium's sidebar itself: extensions can't, and Helium doesn't accept AI-written patches
- [ ] Auto-archive: close tabs untouched for 12 h / 24 h / 7 d / 30 d (never pinned or playing ones), with an archive to restore them
- [ ] Air Traffic Control: rules that send links from other apps to a specific window or tab group
- [ ] Live Folders: GitHub PRs and issues, RSS, kept up to date (in the palette)
- [ ] Recent pages preview: the last pages you visited on a site (Notion, Figma, Docs…)

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

- [ ] Capture: screenshot part of a page and copy or save it
- [ ] Easel: a whiteboard of captures and live page snippets (large; later, if ever)
- [ ] Notes (Arc's documents)

## Other

- [x] **Helium:** translate, share, site settings (Site Control Center), downloads
- ✗ Arc sync, accounts, membership: there's no backend by design
- ✗ Sound effects: not worth it
