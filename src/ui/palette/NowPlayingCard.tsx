import { useEffect, useState } from 'react';
import { togglePictureInPicture } from '@/features/pip/page';
import { send } from '@/shared/send';
import type { NowPlaying } from '@/shared/types';

/** Arc's mini player, in the palette: what's playing in any tab, with its controls. */
export function NowPlayingCard({ items, onChange, onClose }: { items: NowPlaying[]; onChange: () => void; onClose: () => void }) {
  const [waitingFor, setWaitingFor] = useState<string>();
  const [error, setError] = useState<string>();

  // After asking for access from the in-page palette, refresh until the grant window is answered.
  useEffect(() => {
    if (!waitingFor) return;
    const timer = setInterval(async () => {
      if (await send({ type: 'permissions/has', origin: waitingFor })) {
        setWaitingFor(undefined);
        onChange();
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [waitingFor, onChange]);

  const act = (item: NowPlaying, action: 'toggle' | 'next' | 'previous' | 'mute') =>
    void send({ type: 'media/action', tabId: item.tabId, action }).then(onChange);

  async function allow(origin: string) {
    if (typeof browser.permissions?.request === 'function') {
      if (await browser.permissions.request({ origins: [origin] })) onChange();
      return;
    }
    await send({ type: 'permissions/open-grant', origins: [origin] });
    setWaitingFor(origin);
  }

  return (
    <section className="hm-now-playing" aria-label="Now playing">
      {items.slice(0, 2).map((item) => (
        <div key={item.tabId} className="hm-np-row">
          {item.artworkUrl ? (
            <img className="hm-np-art" src={item.artworkUrl} alt="" />
          ) : (
            <span className="hm-np-art hm-np-art-empty" aria-hidden="true">
              {item.favIconUrl?.startsWith('https:') ? <img src={item.favIconUrl} alt="" /> : '♪'}
            </span>
          )}
          <span className="hm-np-text">
            <span className="hm-np-title">{item.title}</span>
            <span className="hm-np-artist">{item.artist}</span>
          </span>
          <span className="hm-np-controls">
            {item.controllable ? (
              <>
                {item.canSkip && (
                  <button aria-label="Previous" title="Previous" onClick={() => act(item, 'previous')}>
                    ⏮
                  </button>
                )}
                <button aria-label={item.playing ? 'Pause' : 'Play'} title={item.playing ? 'Pause' : 'Play'} onClick={() => act(item, 'toggle')}>
                  {item.playing ? '❚❚' : '▶'}
                </button>
                {item.canSkip && (
                  <button aria-label="Next" title="Next" onClick={() => act(item, 'next')}>
                    ⏭
                  </button>
                )}
              </>
            ) : (
              item.accessOrigin && (
                <button className="hm-np-allow" onClick={() => void allow(item.accessOrigin!)} disabled={waitingFor === item.accessOrigin}>
                  {waitingFor === item.accessOrigin ? 'Waiting…' : 'Allow control'}
                </button>
              )
            )}
            <button aria-label={item.muted ? 'Unmute tab' : 'Mute tab'} title={item.muted ? 'Unmute tab' : 'Mute tab'} onClick={() => act(item, 'mute')}>
              {item.muted ? '🔇' : '🔊'}
            </button>
            {item.hasVideo && item.current && (
              <button
                aria-label="Picture in picture"
                title="Picture in picture"
                // Synchronous inside the click, which is what lets the browser open the window.
                onClick={() => togglePictureInPicture().then(onClose, (err: Error) => setError(err.message))}
              >
                ⧉
              </button>
            )}
            {!item.current && (
              <button aria-label="Go to tab" title="Go to tab" onClick={() => void send({ type: 'tabs/activate', tabId: item.tabId }).then(onClose)}>
                ↗
              </button>
            )}
          </span>
        </div>
      ))}
      {error && (
        <p className="hm-warning hm-np-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
