import { z } from 'zod';
import type { SerializedError } from './errors';
import type { AiStatus, PageAnswer, TabSummary, TidyResult, UndoResult } from './types';

/** Requests the UI (content-script palette, popup palette, options page) may send to the background. */
export const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tabs/list'), windowId: z.number().int().optional() }),
  z.object({ type: z.literal('tabs/activate'), tabId: z.number().int() }),
  z.object({ type: z.literal('ai/status') }),
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
  z.object({ type: z.literal('op/cancel'), opId: z.string() }),
  z.object({ type: z.literal('settings/open') }),
]);

export type Request = z.infer<typeof requestSchema>;

export interface ResponseMap {
  'tabs/list': TabSummary[];
  'tabs/activate': null;
  'ai/status': AiStatus;
  'tidy/run': TidyResult;
  'tidy/undo': UndoResult;
  'tidy/can-undo': boolean;
  'page/ask': PageAnswer;
  'page/forget': null;
  'op/cancel': null;
  'settings/open': null;
}

export type Reply<T extends Request['type']> =
  | { ok: true; data: ResponseMap[T] }
  | { ok: false; error: SerializedError };

export type PaletteIntent = 'tidy';

/** Sent by the background to the palette content script. With an intent, the palette opens and runs it. */
export interface PaletteSignal {
  type: 'palette/toggle';
  intent?: PaletteIntent;
}

export async function send<T extends Request>(request: T): Promise<ResponseMap[T['type']]> {
  const reply = (await browser.runtime.sendMessage(request)) as Reply<T['type']> | undefined;
  if (!reply) throw new Error('No response from Helium Max background.');
  if (!reply.ok) throw Object.assign(new Error(reply.error.message), { kind: reply.error.kind });
  return reply.data;
}
