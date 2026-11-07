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
  | 'open-sidebar'
  | 'pip'
  | 'media-toggle'
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
    id: 'open-sidebar',
    title: 'Open Sidebar',
    description: 'Show your pinned tabs in a column beside the page (⇧⌘S).',
    keywords: 'side panel sidebar pinned favorites column',
    icon: '▥',
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
