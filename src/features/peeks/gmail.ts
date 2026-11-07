import { UserFacingError } from '@/shared/errors';
import type { GmailPeek } from '@/shared/types';

export const GMAIL_ORIGIN = 'https://mail.google.com/*';

/** Gmail's unread feed for an account (u/0, u/1…). Uses the browser's Gmail session. */
export function gmailFeedUrl(account: number, base = 'https://mail.google.com'): string {
  return `${base}/mail/u/${account}/feed/atom`;
}

export function gmailInboxUrl(account: number, base = 'https://mail.google.com'): string {
  return `${base}/mail/u/${account}/#inbox`;
}

/** The account the user's open Gmail tab uses, so the peek matches what they see. */
export function accountFromUrl(url: string | undefined): number {
  const match = url ? /mail\.google\.com\/mail\/u\/(\d+)/.exec(url) : null;
  return match ? Number(match[1]) : 0;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
      return ENTITIES[entity.toLowerCase()] ?? '';
    })
    .trim();
}

function tag(xml: string, name: string): string {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return match ? decode(match[1]!) : '';
}

/**
 * Parse Gmail's Atom feed. The service worker has no DOMParser and the format is small and
 * stable, so a narrow parser is enough. Only links into mail.google.com are kept.
 */
export function parseGmailAtom(xml: string, base = 'https://mail.google.com'): GmailPeek {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(([, entry]) => {
    const href = decode(/<link[^>]*href="([^"]+)"/i.exec(entry!)?.[1] ?? '');
    const author = /<author>([\s\S]*?)<\/author>/i.exec(entry!)?.[1] ?? '';
    return {
      subject: tag(entry!, 'title') || '(no subject)',
      snippet: tag(entry!, 'summary'),
      from: tag(author, 'name') || tag(author, 'email'),
      date: tag(entry!, 'issued') || tag(entry!, 'modified'),
      url: href.startsWith(`${base}/`) ? href : '',
    };
  });
  const count = Number(tag(xml, 'fullcount'));
  return { unreadCount: Number.isFinite(count) ? count : entries.length, messages: entries.slice(0, 20) };
}

export async function fetchGmail(account: number, { base, fetchImpl = fetch }: { base?: string; fetchImpl?: typeof fetch } = {}): Promise<GmailPeek> {
  let response: Response;
  try {
    response = await fetchImpl(gmailFeedUrl(account, base), { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new UserFacingError('network', 'Could not reach Gmail.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new UserFacingError('auth', `Not signed in to Gmail account ${account} in this browser. Open Gmail and sign in, then try again.`);
  }
  if (!response.ok) throw new UserFacingError('network', `Gmail answered HTTP ${response.status}.`);
  const text = await response.text();
  if (!/<feed[\s>]/i.test(text)) throw new UserFacingError('invalid-output', 'Gmail did not return its unread feed.');
  return parseGmailAtom(text, base);
}
