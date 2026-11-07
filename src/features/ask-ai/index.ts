import { activeProvider } from "@/ai/active";
import { complete } from "@/ai/client";
import type { ChatMessage } from "@/ai/types";

const SYSTEM_PROMPT = `You are a quick assistant inside the user's browser command bar.
Answer directly and concisely, leading with the answer. Use short paragraphs or "- " bullets; no tables or headings.
You can't browse or see the user's tabs. If something depends on current events or a specific page, say so and suggest Instant Links or Ask Page.
Say when you're unsure instead of guessing. Answer in the language the user writes in.`;

/** The command bar's "ask anything": a short conversation with the profile set for Ask AI. */
export async function askAi(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const { config, settings } = await activeProvider("ask");
  return complete(config, {
    system: SYSTEM_PROMPT,
    messages: messages.slice(-20),
    temperature: settings.temperature,
    maxOutputTokens: settings.maxOutputTokens,
    signal,
    sessionId: undefined,
  });
}
