import { useEffect, useState } from 'react';
import { send } from '@/shared/send';

/**
 * Asks for site access the in-page palette can't request itself: extension pages prompt directly,
 * the overlay opens Blimp's grant window and waits for the answer.
 */
export function AccessRequest({ origins, reason, onGranted }: { origins: string[]; reason: string; onGranted: () => void }) {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      const granted = await Promise.all(origins.map((origin) => send({ type: 'permissions/has', origin })));
      if (granted.every(Boolean)) {
        clearInterval(timer);
        onGranted();
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [waiting, origins, onGranted]);

  async function allow() {
    if (typeof browser.permissions?.request === 'function') {
      if (await browser.permissions.request({ origins })) onGranted();
      return;
    }
    await send({ type: 'permissions/open-grant', origins });
    setWaiting(true);
  }

  return (
    <div className="hm-access">
      <p>{reason}</p>
      <ul className="hm-plain-list">
        {origins.map((origin) => (
          <li key={origin}>
            <code>{origin.replace(/^https?:\/\//, '').replace(/\/\*$/, '')}</code>
          </li>
        ))}
      </ul>
      {waiting ? (
        <p className="hm-muted" role="status">
          Waiting for you to allow access in the Blimp window…
        </p>
      ) : (
        <button className="hm-button hm-primary" onClick={() => void allow()}>
          Allow access
        </button>
      )}
    </div>
  );
}
