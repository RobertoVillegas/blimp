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
export type AdapterKind = 'openai' | 'openai-compatible' | 'openai-responses' | 'anthropic' | 'gemini' | 'ollama';

/** Wire API a model is served on, for gateways that serve different models on different APIs. */
export type ModelApi = 'chat' | 'messages' | 'responses';

export interface ProfileSummary {
  id: string;
  name: string;
  model: string;
  active: boolean;
}

/** Features that can use their own AI profile instead of the active one. */
export const AI_FEATURES = ['tidy', 'page', 'tabs', 'previews', 'instant', 'downloads'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export interface AiStatus {
  profileId: string;
  profileName: string;
  model: string;
  configured: boolean;
  /** Hosted providers receive page text when a feature is invoked; local ones don't leave the machine. */
  hosted: boolean;
  problem?: string;
  /** Status of the profiles some features use instead of the active one. */
  byFeature?: Partial<Record<AiFeature, AiStatus>>;
}

export interface TidyGroupResult {
  title: string;
  color: GroupColor;
  tabCount: number;
  /** Tabs were added to a group the user already had. */
  existing?: boolean;
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
  /** Discarded by the browser; readable only if the user asks to wake it. */
  asleep?: boolean;
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
  /** The linked page's own image (og:image or first article image), shown above the summary. */
  imageUrl?: string;
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

export interface TitleProposal {
  tabId: number;
  url: string;
  favIconUrl?: string;
  /** The site's own title. */
  original: string;
  /** The name Helium Max shows now, if any. */
  current?: string;
  proposed: string;
}

export interface PageAnswer {
  text: string;
  title: string;
  url: string;
  truncated: boolean;
}
