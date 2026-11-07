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

export interface CrossTabCandidate {
  tabId: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  /** Why the tab can't be read; absent when it can. */
  blocked?: string;
}

export interface CrossTabSource {
  n: number;
  tabId: number;
  title: string;
  url: string;
  truncated: boolean;
}

export interface CrossTabSkipped {
  tabId: number;
  title: string;
  url: string;
  reason: string;
}

export interface CrossTabResult {
  text: string;
  sources: CrossTabSource[];
  skipped: CrossTabSkipped[];
  /** Number of model calls; >1 means the tabs were summarized in batches first. */
  calls: number;
}

export interface LinkPreview {
  url: string;
  title: string;
  domain: string;
  summary?: string;
  /** Set instead of `summary` when the page could not be summarized honestly. */
  unavailable?: string;
}

export interface SearchCandidate {
  title: string;
  url: string;
  snippet: string;
}

export interface InstantLinksResult {
  configured: boolean;
  providerLabel: string;
  results: SearchCandidate[];
  /** Index into `results` of the recommended link, if any. */
  best: number | null;
  /** One line from the model on why `best` fits, or why ranking was skipped. */
  note?: string;
  rankedBy?: string;
}

export interface PageAnswer {
  text: string;
  title: string;
  url: string;
  truncated: boolean;
}
