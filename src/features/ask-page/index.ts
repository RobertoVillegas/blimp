import { activeProvider } from '@/ai/active';
import { truncateToTokens } from '@/ai/budget';
import { complete } from '@/ai/client';
import type { ChatMessage } from '@/ai/types';
import { UserFacingError } from '@/shared/errors';
import type { PageAnswer } from '@/shared/types';
import { isHttpUrl } from '@/shared/url';
import { extractPageContent, type ExtractedPage } from './extract';
import { PAGE_SYSTEM_PROMPT, SUMMARY_REQUEST, pageContext } from './prompt';

/** One conversation per tab, kept in session storage only (gone when the browser quits). */
interface PageConversation {
  url: string;
  sessionId: string;
  context: string;
  title: string;
  truncated: boolean;
  messages: ChatMessage[];
}

const MAX_FOLLOW_UPS = 20;
const conversationKey = (tabId: number) => `page:${tabId}`;

export async function askPage(
  tabId: number,
  question: string | null,
  signal?: AbortSignal,
): Promise<PageAnswer> {
  const { config, settings } = await activeProvider('page');
  const tab = await browser.tabs.get(tabId);

  let conversation = await loadConversation(tabId);
  if (!conversation || conversation.url !== tab.url) {
    const page = await readPage(tabId, tab.url, settings.maxInputTokens * 4);
    const { text, truncated } = truncateToTokens(page.text, settings.maxInputTokens);
    conversation = {
      url: page.url,
      sessionId: crypto.randomUUID(),
      title: page.title,
      context: pageContext({ ...page, text }, truncated),
      truncated,
      messages: [],
    };
  }

  const prompt = question?.trim() || SUMMARY_REQUEST;
  // The first user turn carries the page; later turns are plain follow-ups.
  const [opening = [], recent = []] =
    conversation.messages.length > 2
      ? [conversation.messages.slice(0, 2), conversation.messages.slice(2).slice(-MAX_FOLLOW_UPS * 2)]
      : [conversation.messages, []];
  const messages: ChatMessage[] = [
    ...opening,
    ...recent,
    { role: 'user', content: opening.length ? prompt : `${conversation.context}\n\n${prompt}` },
  ];

  const text = await complete(config, {
    system: PAGE_SYSTEM_PROMPT,
    messages,
    temperature: settings.temperature,
    maxOutputTokens: settings.maxOutputTokens,
    signal,
    sessionId: conversation.sessionId,
  });

  conversation.messages = [...messages, { role: 'assistant', content: text }];
  await browser.storage.session.set({ [conversationKey(tabId)]: conversation });
  return { text, title: conversation.title, url: conversation.url, truncated: conversation.truncated };
}

export async function forgetPage(tabId: number): Promise<void> {
  await browser.storage.session.remove(conversationKey(tabId));
}

async function loadConversation(tabId: number): Promise<PageConversation | undefined> {
  const stored = await browser.storage.session.get(conversationKey(tabId));
  return stored[conversationKey(tabId)] as PageConversation | undefined;
}

async function readPage(tabId: number, url: string | undefined, maxChars: number): Promise<ExtractedPage> {
  if (!isHttpUrl(url)) {
    throw new UserFacingError(
      'page-unavailable',
      'Helium Max can only read regular web pages (http/https). Browser pages, PDFs in the built-in viewer and extension pages are off limits.',
    );
  }
  let page: ExtractedPage | undefined;
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId },
      func: extractPageContent,
      args: [maxChars],
    });
    page = result?.result as ExtractedPage | undefined;
  } catch {
    throw new UserFacingError(
      'page-unavailable',
      'This page cannot be read by extensions (restricted site or missing permission). Open the palette on the page with ⌘K or the toolbar button, then try again.',
    );
  }
  if (!page || page.text.length < 40) {
    throw new UserFacingError(
      'page-unavailable',
      'No readable text was found on this page. It may be an image, a PDF, or content inside a cross-origin frame.',
    );
  }
  return page;
}
