export const GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;

export type GroupColor = (typeof GROUP_COLORS)[number];

export interface TabSummary {
  id: number;
  windowId: number;
  index: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  pinned: boolean;
  groupId: number;
}

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'ollama' | 'custom';

export interface AiStatus {
  provider: ProviderId;
  providerLabel: string;
  model: string;
  configured: boolean;
  /** Hosted providers receive page text when a feature is invoked; local ones don't leave the machine. */
  hosted: boolean;
  problem?: string;
}

export interface TidyGroupResult {
  title: string;
  color: GroupColor;
  tabCount: number;
}

export interface TidyResult {
  groups: TidyGroupResult[];
  ungroupedCount: number;
  skippedCount: number;
}

export interface UndoResult {
  restoredCount: number;
  conflicts: string[];
}

export interface PageAnswer {
  text: string;
  title: string;
  url: string;
  truncated: boolean;
}
