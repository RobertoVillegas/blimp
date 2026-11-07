export type CommandId =
  | 'tidy'
  | 'undo-tidy'
  | 'summarize-page'
  | 'ask-page'
  | 'summarize-tabs'
  | 'ask-tabs'
  | 'instant-links'
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
    milestone: 'M2',
  },
  {
    id: 'ask-tabs',
    title: 'Ask Across Tabs',
    description: 'Ask a question answered from several tabs.',
    keywords: 'cross research question',
    icon: '⁇',
    milestone: 'M2',
  },
  {
    id: 'instant-links',
    title: 'Instant Links',
    description: 'Find and open the best result for a request.',
    keywords: 'search navigate open find go',
    icon: '↗',
    milestone: 'M3',
  },
  {
    id: 'settings',
    title: 'AI Settings',
    description: 'Provider, model, API key and privacy options.',
    keywords: 'provider key model options preferences configure',
    icon: '⚙',
  },
];

export function matches(query: string, ...fields: string[]): boolean {
  const haystack = fields.join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}
