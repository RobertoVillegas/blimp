import { z } from 'zod';
import type { SerializedError } from './errors';
import type {
  AiStatus,
  CrossTabCandidate,
  CrossTabResult,
  InstantLinksResult,
  LinkPreview,
  PageAnswer,
  ProfileSummary,
  TabSummary,
  TidyResult,
  TitleProposal,
  NowPlaying,
  GmailPeek,
  CalendarEvent,
  BrowseSource,
  ArchivedTab,
  LiveFolderView,
  UndoResult,
} from './types';

/** Requests the UI (content-script palette, popup palette, options page) may send to the background. */
export const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tabs/list'), windowId: z.number().int().optional() }),
  z.object({ type: z.literal('tabs/activate'), tabId: z.number().int() }),
  z.object({ type: z.literal('ai/status') }),
  z.object({ type: z.literal('profiles/list') }),
  z.object({ type: z.literal('profiles/activate'), profileId: z.string() }),
  z.object({ type: z.literal('tidy/run'), opId: z.string(), windowId: z.number().int().optional() }),
  z.object({ type: z.literal('tidy/undo'), windowId: z.number().int().optional() }),
  z.object({ type: z.literal('tidy/can-undo') }),
  z.object({
    type: z.literal('page/ask'),
    opId: z.string(),
    tabId: z.number().int().optional(),
    question: z.string().max(4000).nullable(),
  }),
  z.object({ type: z.literal('page/forget'), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('cross/candidates'), windowId: z.number().int().optional() }),
  z.object({
    type: z.literal('cross/missing-origins'),
    tabIds: z.array(z.number().int()).max(100),
    tabId: z.number().int().optional(),
  }),
  z.object({
    type: z.literal('cross/run'),
    opId: z.string(),
    windowId: z.number().int().optional(),
    tabIds: z.array(z.number().int()).min(1).max(100),
    question: z.string().max(4000).nullable(),
    wake: z.boolean().optional(),
  }),
  z.object({ type: z.literal('permissions/has'), origin: z.string().max(300) }),
  z.object({ type: z.literal('permissions/open-grant'), origins: z.array(z.string().max(300)).min(1).max(100) }),
  z.object({ type: z.literal('preview/start'), opId: z.string(), url: z.string().max(4000) }),
  z.object({
    type: z.literal('preview/finish'),
    opId: z.string(),
    page: z.object({
      url: z.string().max(4000),
      finalUrl: z.string().max(4000),
      title: z.string().max(500),
      description: z.string().max(2000),
      siteName: z.string().max(200),
      text: z.string().max(40_000),
      hasPasswordField: z.boolean(),
      imageUrl: z.string().max(4000).optional(),
    }),
  }),
  z.object({ type: z.literal('preview/image'), opId: z.string(), url: z.string().max(4000) }),
  z.object({ type: z.literal('instant/search'), opId: z.string(), query: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal('instant/open'), url: z.string().max(4000), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('instant/web-search'), query: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal('instant/open-many'), urls: z.array(z.string().max(4000)).min(1).max(5), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('update/status') }),
  z.object({ type: z.literal('update/check') }),
  z.object({ type: z.literal('update/show') }),
  z.object({ type: z.literal('titles/propose'), opId: z.string(), windowId: z.number().int().optional() }),
  z.object({
    type: z.literal('titles/apply'),
    items: z.array(z.object({ tabId: z.number().int(), title: z.string().max(200) })).min(1).max(100),
  }),
  z.object({ type: z.literal('titles/restore'), tabIds: z.array(z.number().int()).min(1).max(100) }),
  z.object({ type: z.literal('titles/current'), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('media/list'), tabId: z.number().int().optional() }),
  z.object({
    type: z.literal('media/action'),
    tabId: z.number().int(),
    action: z.enum(['toggle', 'next', 'previous', 'mute']),
  }),
  z.object({ type: z.literal('peek/gmail') }),
  z.object({ type: z.literal('peek/calendar') }),
  z.object({ type: z.literal('peek/open'), url: z.string().max(4000) }),
  z.object({
    type: z.literal('ai/ask'),
    opId: z.string(),
    messages: z
      .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(16_000) }))
      .min(1)
      .max(40),
  }),
  z.object({ type: z.literal('browse/fetch'), opId: z.string(), query: z.string().trim().min(1).max(500) }),
  z.object({
    type: z.literal('browse/answer'),
    opId: z.string(),
    query: z.string().max(500),
    sources: z
      .array(z.object({ n: z.number().int(), url: z.string().max(4000), title: z.string().max(500), snippet: z.string().max(1000), text: z.string().max(20_000) }))
      .min(1)
      .max(8),
  }),
  z.object({ type: z.literal('little/open'), url: z.string().max(4000).optional() }),
  z.object({ type: z.literal('little/status'), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('little/to-main'), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('little/close-all') }),
  z.object({ type: z.literal('archive/list') }),
  z.object({ type: z.literal('archive/restore'), id: z.string().max(64), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('archive/clear') }),
  /** Runs auto-archive now; `now` lets e2e builds pretend time has passed. */
  z.object({ type: z.literal('archive/run'), now: z.number().optional() }),
  z.object({ type: z.literal('capture/visible') }),
  z.object({ type: z.literal('live/list'), refresh: z.boolean().optional() }),
  z.object({ type: z.literal('live/refresh'), folderId: z.string().max(64).optional() }),
  z.object({ type: z.literal('live/open'), folderId: z.string().max(64), itemIds: z.array(z.string().max(500)).min(1).max(10), tabId: z.number().int().optional() }),
  z.object({ type: z.literal('live/seen'), folderId: z.string().max(64), itemIds: z.array(z.string().max(500)).max(100) }),
  z.object({ type: z.literal('op/cancel'), opId: z.string() }),
  z.object({ type: z.literal('settings/open') }),
  z.object({ type: z.literal('shortcut/get'), name: z.string().max(50) }),
]);

export type Request = z.infer<typeof requestSchema>;

export interface ResponseMap {
  'tabs/list': TabSummary[];
  'tabs/activate': null;
  'ai/status': AiStatus;
  'profiles/list': ProfileSummary[];
  'profiles/activate': AiStatus;
  'tidy/run': TidyResult;
  'tidy/undo': UndoResult;
  'tidy/can-undo': boolean;
  'page/ask': PageAnswer;
  'page/forget': null;
  'cross/candidates': CrossTabCandidate[];
  'cross/missing-origins': string[];
  'cross/run': CrossTabResult;
  'permissions/open-grant': null;
  'permissions/has': boolean;
  'preview/start': PreviewStart;
  'preview/finish': LinkPreview;
  'preview/image': string | null;
  'instant/search': InstantLinksResult;
  'instant/open': null;
  'instant/web-search': null;
  'instant/open-many': null;
  'update/status': UpdateStatus;
  'update/check': UpdateStatus;
  'update/show': null;
  'titles/propose': TitleProposal[];
  'titles/apply': string[];
  'titles/restore': number;
  'titles/current': { tabId: number; title: string; renamed: boolean } | null;
  'media/list': NowPlaying[];
  'media/action': NowPlaying | null;
  'peek/gmail': GmailPeek & { inboxUrl: string };
  'peek/calendar': CalendarEvent[];
  'peek/open': null;
  'ai/ask': string;
  'browse/fetch': BrowseFetchPage[];
  'browse/answer': string;
  'little/open': null;
  'little/status': { inLittle: boolean };
  'little/to-main': null;
  'little/close-all': number;
  'archive/list': ArchivedTab[];
  'archive/restore': null;
  'archive/clear': null;
  'archive/run': number;
  'capture/visible': string;
  'live/list': LiveFolderView[];
  'live/refresh': LiveFolderView[];
  'live/open': null;
  'live/seen': null;
  'op/cancel': null;
  'settings/open': null;
  'shortcut/get': string;
}

export interface BrowseFetchPage {
  n: number;
  url: string;
  title: string;
  snippet: string;
  html?: string;
  needsOrigin?: string;
}

export interface UpdateStatus {
  current: string;
  /** Set after Blimp reloaded itself into a newer build copied into its folder. */
  autoUpdated?: { from: string; to: string; at: number };
  update: { version: string; pageUrl: string; downloadUrl: string } | null;
}

export type PreviewStart = { kind: 'done'; preview: LinkPreview } | { kind: 'parse'; html: string; finalUrl: string };

export type Reply<T extends Request['type']> =
  | { ok: true; data: ResponseMap[T] }
  | { ok: false; error: SerializedError };

export type PaletteIntent = 'tidy';

/** Sent by the background to the palette content script. With an intent, the palette opens and runs it. */
export interface PaletteSignal {
  type: 'palette/toggle';
  intent?: PaletteIntent;
}

