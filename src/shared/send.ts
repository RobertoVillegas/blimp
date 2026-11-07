import type { Reply, Request, ResponseMap } from "./messages";

/** Ask the background worker to do something. Type-only imports keep zod out of content scripts. */
export async function send<T extends Request>(
  request: T,
): Promise<ResponseMap[T["type"]]> {
  const reply = (await browser.runtime.sendMessage(request)) as
    Reply<T["type"]> | undefined;
  if (!reply) throw new Error("No response from Blimp background.");
  if (!reply.ok)
    throw Object.assign(new Error(reply.error.message), {
      kind: reply.error.kind,
    });
  return reply.data;
}
