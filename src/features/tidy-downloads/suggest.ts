import { basename } from './filename';

export const SUGGEST_TIMEOUT_MS = 4_000;

export interface DownloadContext {
  filename: string;
  mime: string;
  /** Host and path only; query strings often carry tokens. */
  source: string;
  referrer: string;
  pageTitle: string;
}

type Suggest = (suggestion?: { filename: string; conflictAction: 'uniquify' }) => void;

export interface DeterminingDeps {
  isEnabled(): Promise<boolean>;
  /** Proposed filename (already safe), or null to keep the browser's. */
  propose(context: DownloadContext, signal: AbortSignal): Promise<string | null>;
  pageTitleFor(referrer: string): Promise<string>;
  timeoutMs?: number;
}

/**
 * downloads.onDeterminingFilename handler. Calls `suggest` exactly once, within `timeoutMs`,
 * falling back to the browser's own name on any failure. Returns true because it answers async.
 */
export function handleDeterminingFilename(item: Browser.downloads.DownloadItem, suggest: Suggest, deps: DeterminingDeps): true {
  const controller = new AbortController();
  let done = false;
  const finish = (filename?: string | null) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    controller.abort();
    if (filename) suggest({ filename, conflictAction: 'uniquify' });
    else suggest();
  };
  const timer = setTimeout(() => finish(), deps.timeoutMs ?? SUGGEST_TIMEOUT_MS);

  void (async () => {
    if (!(await deps.isEnabled())) return finish();
    const context: DownloadContext = {
      filename: basename(item.filename) || basename(new URL(item.finalUrl || item.url).pathname) || 'download',
      mime: item.mime ?? '',
      source: withoutQuery(item.finalUrl || item.url),
      referrer: withoutQuery(item.referrer ?? ''),
      pageTitle: item.referrer ? await deps.pageTitleFor(item.referrer) : '',
    };
    finish(await deps.propose(context, controller.signal));
  })().catch(() => finish());
  return true;
}

function withoutQuery(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return url.protocol;
    return `${url.hostname}${url.pathname}`;
  } catch {
    return '';
  }
}
