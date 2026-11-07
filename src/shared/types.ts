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

export type PresetId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'mistral'
  | 'opencode-go'
  | 'openrouter'
  | 'ollama'
  | 'custom';

/** Wire protocol a profile speaks. */
export type AdapterKind = 'openai' | 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama';

export interface ProfileSummary {
  id: string;
  name: string;
  model: string;
  active: boolean;
}

export interface AiStatus {
  profileId: string;
  profileName: string;
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
