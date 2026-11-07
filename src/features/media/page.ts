export type MediaAction = 'state' | 'toggle' | 'next' | 'previous';

export interface PageMedia {
  playing: boolean;
  hasVideo: boolean;
  title: string;
  artist: string;
  artworkUrl: string;
  canSkip: boolean;
}

/**
 * Runs in a tab (scripting.executeScript), so it must be self-contained. Reads what the page is
 * playing and, if asked, toggles playback or skips. Skipping only works on players we know,
 * since other scripts can't trigger a page's media-session handlers.
 */
export function controlMedia(action: MediaAction): PageMedia | null {
  const media = [...document.querySelectorAll<HTMLMediaElement>('video, audio')].filter((el) => el.readyState >= 1 || !el.paused);
  const active = media.find((el) => !el.paused && !el.ended) ?? media.find((el) => el.currentTime > 0) ?? media[0];

  const SKIP: Record<string, [next: string, previous: string]> = {
    'www.youtube.com': ['.ytp-next-button', '.ytp-prev-button'],
    'music.youtube.com': ['.next-button', '.previous-button'],
    'open.spotify.com': ['[data-testid="control-button-skip-forward"]', '[data-testid="control-button-skip-back"]'],
    'soundcloud.com': ['.skipControl__next', '.skipControl__previous'],
  };
  const skip = SKIP[location.hostname];

  if (action === 'toggle' && active) {
    if (active.paused) void active.play().catch(() => undefined);
    else active.pause();
  } else if ((action === 'next' || action === 'previous') && skip) {
    document.querySelector<HTMLElement>(skip[action === 'next' ? 0 : 1])?.click();
  }

  if (!active && !navigator.mediaSession?.metadata) return null;
  const metadata = navigator.mediaSession?.metadata;
  const artwork = metadata?.artwork?.at(-1)?.src ?? '';
  return {
    playing: action === 'toggle' && active ? !active.paused : Boolean(active && !active.paused && !active.ended),
    hasVideo: active instanceof HTMLVideoElement,
    title: metadata?.title || document.title,
    artist: metadata?.artist || location.hostname.replace(/^www\./, ''),
    artworkUrl: /^https:/.test(artwork) ? artwork : '',
    canSkip: Boolean(skip),
  };
}
