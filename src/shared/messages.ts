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
  z.object({ type: z.literal('update/status') }),
  z.object({ type: z.literal('update/check') }),
  z.object({ type: z.literal('update/show') }),
  z.object({ type: z.literal('op/cancel'), opId: z.string() }),
  z.object({ type: z.literal('settings/open') }),
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
  'preview/start': PreviewStart;
  'preview/finish': LinkPreview;
  'preview/image': string | null;
  'instant/search': InstantLinksResult;
  'instant/open': null;
  'instant/web-search': null;
  'update/status': UpdateStatus;
  'update/check': UpdateStatus;
  'update/show': null;
  'op/cancel': null;
  'settings/open': null;
}

export interface UpdateStatus {
  current: string;
  /** Set after Helium Max reloaded itself into a newer build copied into its folder. */
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

