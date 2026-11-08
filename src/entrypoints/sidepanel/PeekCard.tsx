import { useEffect, useState } from 'react';
import { send } from '@/shared/send';
import type { CalendarEvent, GmailPeek } from '@/shared/types';
import { dayLabel, relativeTime, timeRange } from '@/ui/palette/PeekView';

export type PeekKind = 'gmail' | 'calendar';

export function peekKind(url: string | undefined): PeekKind | undefined {
  if (url?.startsWith('https://mail.google.com/')) return 'gmail';
  if (url?.startsWith('https://calendar.google.com/')) return 'calendar';
  return undefined;
}

type Data = { kind: 'gmail'; peek: GmailPeek & { inboxUrl: string } } | { kind: 'calendar'; events: CalendarEvent[] };

// Hovering back and forth shouldn't refetch every time.
const cache = new Map<PeekKind, { at: number; data: Data }>();
const FRESH_MS = 60_000;

/** Arc's hover card on a Gmail or Calendar favorite: unread mail or what's next, without switching tabs. */
export function PeekCard({
  kind,
  tabId,
  onMouseEnter,
  onMouseLeave,
  onDone,
}: {
  kind: PeekKind;
  tabId: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDone: () => void;
}) {
  const cached = cache.get(kind);
  const [data, setData] = useState<Data | undefined>(cached?.data);
  const [error, setError] = useState<{ message: string; setup: boolean }>();

  useEffect(() => {
    setError(undefined);
    const hit = cache.get(kind);
    setData(hit?.data);
    if (hit && Date.now() - hit.at < FRESH_MS) return;
    const request: Promise<Data> =
      kind === 'gmail'
        ? send({ type: 'peek/gmail' }).then((peek) => ({ kind: 'gmail', peek }))
        : send({ type: 'peek/calendar' }).then((events) => ({ kind: 'calendar', events }));
    let current = true;
    request
      .then((result) => {
        cache.set(kind, { at: Date.now(), data: result });
        if (current) setData(result);
      })
      .catch((reason: Error & { kind?: string }) => {
        if (current) setError({ message: reason.message, setup: reason.kind === 'not-configured' || reason.kind === 'permission' });
      });
    return () => {
      current = false;
    };
  }, [kind]);

  const open = (url: string) => void send({ type: 'peek/open', url }).then(onDone);

  return (
    <div className="sb-peek" role="dialog" aria-label={kind === 'gmail' ? 'Unread email' : 'Upcoming events'} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {error ? (
        <div className="sb-peek-body">
          <p className="sb-muted">{error.message}</p>
          {error.setup && (
            <button className="sb-text-button" onClick={() => void send({ type: 'settings/open' })}>
              Open Settings
            </button>
          )}
        </div>
      ) : !data ? (
        <div className="sb-peek-body sb-muted" role="status">
          Loading…
        </div>
      ) : data.kind === 'gmail' ? (
        <Gmail peek={data.peek} onOpen={open} onGo={() => void browser.tabs.update(tabId, { active: true }).then(onDone)} />
      ) : (
        <Calendar events={data.events} onOpen={open} onGo={() => void browser.tabs.update(tabId, { active: true }).then(onDone)} />
      )}
    </div>
  );
}

function Gmail({ peek, onOpen, onGo }: { peek: GmailPeek & { inboxUrl: string }; onOpen: (url: string) => void; onGo: () => void }) {
  return (
    <>
      <header className="sb-peek-head">
        <button className="sb-peek-title" onClick={onGo}>
          {peek.unreadCount ? `${peek.unreadCount} unread` : 'Inbox'}
        </button>
        <button className="sb-text-button" onClick={() => onOpen(`${peek.inboxUrl.replace('#inbox', '')}#inbox?compose=new`)}>
          Compose
        </button>
      </header>
      {peek.messages.length === 0 ? (
        <p className="sb-peek-body sb-muted">No unread email.</p>
      ) : (
        <ul className="sb-peek-list" aria-label="Unread email">
          {peek.messages.slice(0, 6).map((message, index) => (
            <li key={index}>
              <button onClick={() => onOpen(message.url || peek.inboxUrl)}>
                <span className="sb-peek-line">
                  <strong>{message.from}</strong>
                  <span className="sb-muted">{relativeTime(message.date)}</span>
                </span>
                <span className="sb-peek-subject">{message.subject}</span>
                {message.snippet && <span className="sb-peek-snippet">{message.snippet}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Calendar({ events, onOpen, onGo }: { events: CalendarEvent[]; onOpen: (url: string) => void; onGo: () => void }) {
  const [next, ...rest] = events;
  return (
    <>
      <header className="sb-peek-head">
        <button className="sb-peek-title" onClick={onGo}>
          {next ? dayLabel(next) : 'Calendar'}
        </button>
      </header>
      {!next ? (
        <p className="sb-peek-body sb-muted">Nothing in the next two days.</p>
      ) : (
        <ul className="sb-peek-list" aria-label="Upcoming events">
          {[next, ...rest.slice(0, 5)].map((event, index) => (
            <li key={index} className={index === 0 ? 'sb-peek-next' : undefined}>
              <div className="sb-peek-event">
                <span className="sb-peek-time">{event.allDay ? 'All day' : timeRange(event)}</span>
                <span className="sb-peek-subject">{event.title}</span>
                {index > 0 && dayLabel(event) !== dayLabel(next) && <span className="sb-muted">{dayLabel(event)}</span>}
                {event.location && <span className="sb-peek-snippet">{event.location}</span>}
              </div>
              {event.meetingUrl && (
                <button className="sb-join" onClick={() => onOpen(event.meetingUrl)}>
                  Join
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
