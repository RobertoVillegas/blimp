# Exploration: an Arc-style sidebar of our own

Branch `explore/sidebar`. A side panel that puts Blimp's features in one Arc-like column, to decide whether it's worth shipping.

![Sidebar](images/sidebar.png) ![Gmail hover card](images/sidebar-gmail.png) ![Calendar hover card](images/sidebar-calendar.png)

## What it does

| Arc | Blimp sidebar | Built on |
| --- | --- | --- |
| Favorites grid | Pinned tabs as icon tiles | `tabs` (pinned) |
| Gmail / Calendar hover cards on favorites | Hovering a pinned Gmail or Calendar tile shows unread mail (with Compose) or upcoming events (with Join) | The existing peeks |
| Pinned folders | Tab groups as collapsible folders, in their color. Collapsing one collapses the group | `tabGroups` |
| Today, with Clear | Ungrouped tabs; **Clear** archives them; **Tidy** groups them with your AI | Archive, Tidy Tabs |
| Drag and drop | Drag a tab between Today, a folder and Favorites (pins, groups or ungroups it) | `tabs.move/group/ungroup` |
| URL bar / Command bar | The address pill opens ⌘K over the page; back, forward, reload above it | Palette |
| Mini player | What's playing, with play/pause/skip | Media |
| Live Folders, Archive, Little Arc | Sections and footer buttons | Existing features |

Open it with **⇧⌘S** or by right-clicking the toolbar icon › **Open sidebar**. Two e2e tests cover the hover cards, folders, drag and drop, Clear and Archive (`e2e/sidebar.spec.ts`).

## Hiding Helium's own tab list

An extension can't hide it, but Helium's **Frameless mode** can (read from Helium's source, `patches/helium/ui/layout/zen-mode*.patch`, in Helium since June 2026). With the sidebar not pinned, Helium's vertical tabs are hidden and slide in only when the cursor touches that window edge. While any side panel is open, Helium keeps the top bar (address bar, toolbar) showing.

Setup, all in `chrome://settings/appearance`:

1. **Layout:** Vertical.
2. **Frameless mode:** on. Leave **Always show the sidebar** off. **Always show the top bar** doesn't matter while Blimp's sidebar is open; Helium shows it anyway.
3. **Side panel position:** left, so Blimp's sidebar sits where Arc's does.
4. **Right-align the tab strip** (the Vertical layout's toggle): Helium's hidden tab list then pops out from the right edge instead of over Blimp's sidebar. If that bothers you near scrollbars, keep it left; then touching the far-left edge shows Helium's tab list over Blimp's.

Blimp can't change these itself. Helium exposes them only to its own settings page (`settingsPrivate`), not to extensions.

## What an extension still can't do (try these in Helium)

- **Opening it needs a key press or click** (⇧⌘S, the toolbar menu). It can't open itself when the browser starts. Once open, it should stay open as you switch tabs in that window.
- **No Spaces yet.** Options: one window per Space (tabs stay alive, closest to Arc), or saved tab sets that close and reopen on switch (what arc-like-chrome-extension does). The window approach looks better.
- **No dragging between the sidebar and Helium's tab list**, no split view, no peeking at links inside the sidebar.

## Decide after a few days of use

1. With Frameless mode hiding Helium's tab list, does Blimp's column feel better than Helium's own vertical tabs + ⌘K?
2. Are the Gmail/Calendar hover cards worth having the column open?
3. If yes: Spaces as windows next, then keyboard navigation in the list and a context menu per tab (rename, duplicate, move to Little Blimp).
