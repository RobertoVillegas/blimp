import type { AiFeature } from '@/shared/types';

export type CommandId =
  | 'tidy'
  | 'undo-tidy'
  | 'tidy-titles'
  | 'rename-tab'
  | 'restore-titles'
  | 'summarize-page'
  | 'ask-page'
  | 'summarize-tabs'
  | 'ask-tabs'
  | 'instant-links'
  | 'browse'
  | 'open-sidebar'
  | 'archive'
  | 'live'
  | 'recent'
  | 'capture'
  | 'little-new'
  | 'little-to-main'
  | 'little-close'
  | 'pip'
  | 'media-toggle'
  | 'copy-url'
  | 'copy-markdown'
  | 'copy-quote'
  | 'peek-gmail'
  | 'peek-calendar'
  | 'settings';

export interface PaletteCommand {
  id: CommandId;
  title: string;
  description: string;
  keywords: string;
  icon: string;
  /** What leaves the browser when this runs; shown before running. */
  sends?: string;
  /** Not built yet; listed so the roadmap is visible, but cannot run. */
  milestone?: string;
}

export const COMMANDS: PaletteCommand[] = [
  {
    id: 'tidy',
    title: 'Tidy Tabs',
    description: 'Group the ungrouped, unpinned tabs in this window into named tab groups.',
    keywords: 'group organize clean sort tabs',
    icon: '▦',
    sends: 'tab titles and URLs',
  },
  {
    id: 'undo-tidy',
    title: 'Undo Tidy Tabs',
    description: 'Ungroup what the last Tidy Tabs created and restore tab order.',
    keywords: 'revert restore ungroup',
    icon: '↶',
  },
  {
    id: 'tidy-titles',
    title: 'Tidy Tab Titles',
    description: 'Give your pinned tabs short names. You see them before anything changes.',
    keywords: 'rename pinned names titles short clean',
    icon: 'Aa',
    sends: 'titles and URLs of your pinned tabs',
  },
  {
    id: 'rename-tab',
    title: 'Rename Tab',
    description: 'Give this tab a name of your own.',
    keywords: 'title name label',
    icon: '✎',
  },
  {
    id: 'restore-titles',
    title: 'Restore Tab Titles',
    description: "Give the tabs in this window their sites' own titles back.",
    keywords: 'undo reset original titles names',
    icon: '↺',
  },
  {
    id: 'summarize-page',
    title: 'Summarize Page',
    description: 'Key points of the current page.',
    keywords: 'tldr summary article read',
    icon: '≡',
    sends: 'the text of this page',
  },
  {
    id: 'ask-page',
    title: 'Ask Page',
    description: 'Ask questions answered from the current page.',
    keywords: 'question chat q&a',
    icon: '?',
    sends: 'the text of this page and your questions',
  },
  {
    id: 'summarize-tabs',
    title: 'Summarize Tabs',
    description: 'One synthesis across the tabs in this window, with sources.',
    keywords: 'cross research synthesis',
    icon: '⧉',
    sends: 'the text of the tabs you pick',
  },
  {
    id: 'ask-tabs',
    title: 'Ask Across Tabs',
    description: 'Ask a question answered from several tabs.',
    keywords: 'cross research question',
    icon: '⁇',
    sends: 'the text of the tabs you pick and your question',
  },
  {
    id: 'instant-links',
    title: 'Instant Links',
    description: 'Find and open the best result for a request, from real search results.',
    keywords: 'search navigate open find go web',
    icon: '↗',
  },
  {
    id: 'pip',
    title: 'Picture in Picture',
    description: 'Float the video on this page in its own window you can move anywhere. Run it again to close it.',
    keywords: 'pip video float floating window mini player popout',
    icon: '⧉',
  },
  {
    id: 'copy-url',
    title: 'Copy URL',
    description: "Copy this page's address.",
    keywords: 'link address clipboard share',
    icon: '⎘',
  },
  {
    id: 'copy-markdown',
    title: 'Copy as Markdown Link',
    description: 'Copy [Page title](address), ready to paste into notes or chat.',
    keywords: 'link markdown clipboard title share',
    icon: '⎘',
  },
  {
    id: 'copy-quote',
    title: 'Copy as Quote',
    description: 'Copy the text you selected as a quote, with a link back to this page.',
    keywords: 'selection quote cite clipboard markdown',
    icon: '❝',
  },
  {
    id: 'peek-gmail',
    title: 'Unread Email',
    description: 'Your unread Gmail without leaving this page.',
    keywords: 'gmail mail inbox unread peek email messages',
    icon: '✉',
  },
  {
    id: 'peek-calendar',
    title: 'Upcoming Events',
    description: 'What is next on your calendar today and tomorrow.',
    keywords: 'calendar agenda meetings events schedule today tomorrow peek',
    icon: '◷',
  },
  {
    id: 'media-toggle',
    title: 'Play or Pause Media',
    description: 'Pause what is playing in any tab, or resume it.',
    keywords: 'music video audio pause play resume stop now playing',
    icon: '⏯',
  },
  {
    id: 'recent',
    title: 'Recent Pages',
    description: 'The pages you visited last on this site, or on a pinned tab\'s site (Notion, Figma, Docs…).',
    keywords: 'recent history pages visited notion figma linear docs pinned',
    icon: '↺',
  },
  {
    id: 'live',
    title: 'Live Folders',
    description: 'GitHub pull requests and issues, and RSS feeds, kept up to date with what is new marked.',
    keywords: 'live folders github pull requests prs issues rss feeds news updates',
    icon: '◉',
  },
  {
    id: 'archive',
    title: 'Archived Tabs',
    description: 'Tabs closed by auto-archive in the last 30 days. Reopen one with Enter.',
    keywords: 'archive closed old history restore reopen',
    icon: '⌫',
  },
  {
    id: 'capture',
    title: 'Capture',
    description: 'Screenshot part of this page: drag to select, or press Enter for everything you see.',
    keywords: 'screenshot screen capture snip image copy',
    icon: '⬚',
  },
  {
    id: 'little-to-main',
    title: 'Open in Main Window',
    description: 'Keep this Little Blimp page: move it into your main window, as it is.',
    keywords: 'little blimp keep move main window tab',
    icon: '⤢',
  },
  {
    id: 'little-new',
    title: 'New Little Blimp',
    description: 'A small window for a quick search or a one-off page (⌥⇧N).',
    keywords: 'little arc quick window popup search',
    icon: '◱',
  },
  {
    id: 'little-close',
    title: 'Close Little Blimp Windows',
    description: 'Close every Little Blimp window.',
    keywords: 'little arc close windows',
    icon: '⊠',
  },
  {
    id: 'open-sidebar',
    title: 'Open Sidebar',
    description: 'Show your pinned tabs in a column beside the page (⇧⌘S).',
    keywords: 'side panel sidebar pinned favorites column',
    icon: '▥',
  },
  {
    id: 'browse',
    title: 'Browse for Me',
    description: 'Search the web, read the top results and get one answer with sources.',
    keywords: 'research search web answer read results',
    icon: '✧',
    sends: 'your search and the text of the top results',
  },
  {
    id: 'settings',
    title: 'AI Settings',
    description: 'Profiles, models, API keys and privacy options. Type "profile" to switch profiles here.',
    keywords: 'provider key model options preferences configure profile',
    icon: '⚙',
  },
];

/** Which per-feature AI profile a command uses (Settings › Models per feature). */
export const FEATURE_OF: Partial<Record<CommandId, AiFeature>> = {
  tidy: 'tidy',
  'tidy-titles': 'tidy',
  'summarize-page': 'page',
  'ask-page': 'page',
  'summarize-tabs': 'tabs',
  'ask-tabs': 'tabs',
  'instant-links': 'instant',
  browse: 'ask',
};

/** Rank for a command that matches: its title equal to, starting with, or containing the query wins. */
export function titleRank(query: string, title: string): number {
  const q = query.trim().toLowerCase();
  const t = title.toLowerCase();
  if (!q) return 0;
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.includes(q)) return 2;
  return 3;
}

export function matches(query: string, ...fields: string[]): boolean {
  const haystack = fields.join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}
