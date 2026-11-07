import { useEffect, useState } from 'react';
import { send } from '@/shared/send';
import type { CalendarEvent, GmailPeek } from '@/shared/types';
import { Footer } from './Footer';

type State<T> = { name: 'loading' } | { name: 'ready'; data: T } | { name: 'error'; message: string; setup: boolean };

/** Arc's favorite-tab previews, in the palette: unread Gmail, or what's next on the calendar. */
export function PeekView({ kind, onBack, onClose }: { kind: 'gmail' | 'calendar'; onBack: () => void; onClose: () => void }) {
  const [state, setState] = useState<State<(GmailPeek & { inboxUrl: string }) | CalendarEvent[]>>({ name: 'loading' });

  useEffect(() => {
    const request = kind === 'gmail' ? send({ type: 'peek/gmail' }) : send({ type: 'peek/calendar' });
    request
      .then((data) => setState({ name: 'ready', data }))
      .catch((error: Error & { kind?: string }) =>
        setState({ name: 'error', message: error.message, setup: error.kind === 'not-configured' || error.kind === 'permission' }),
      );
  }, [kind]);

  const open = (url: string) => void send({ type: 'peek/open', url }).then(onClose);

  return (
    <div className="hm-page">
      <header className="hm-page-header">
        <button className="hm-link" onClick={onBack} aria-label="Back to commands">
          ←
        </button>
        <span className="hm-page-title">{kind === 'gmail' ? 'Unread Email' : 'Upcoming Events'}</span>
        {state.name === 'ready' && kind === 'gmail' && (
          <button className="hm-link" onClick={() => open(`${(state.data as GmailPeek & { inboxUrl: string }).inboxUrl.replace('#inbox', '')}#inbox?compose=new`)}>
            Compose
          </button>
        )}
      </header>

      {state.name === 'loading' && (
        <div className="hm-panel" role="status">
          <div className="hm-spinner" aria-hidden="true" />
        </div>
      )}

      {state.name === 'error' && (
        <div className="hm-panel">
          <p className={state.setup ? undefined : 'hm-warning'} role={state.setup ? undefined : 'alert'}>
            {state.message}
          </p>
          {state.setup && (
            <button className="hm-button hm-primary" onClick={() => void send({ type: 'settings/open' }).then(onClose)}>
              Open Settings
            </button>
          )}
        </div>
      )}

      {state.name === 'ready' && kind === 'gmail' && <GmailList peek={state.data as GmailPeek & { inboxUrl: string }} onOpen={open} />}
      {state.name === 'ready' && kind === 'calendar' && <CalendarList events={state.data as CalendarEvent[]} onOpen={open} />}

      <Footer note={kind === 'gmail' ? 'Read from your Gmail session in this browser; nothing goes to an AI.' : 'Read from your calendar\'s private iCal address; nothing goes to an AI.'} />
    </div>
  );
}

function GmailList({ peek, onOpen }: { peek: GmailPeek & { inboxUrl: string }; onOpen: (url: string) => void }) {
  if (peek.messages.length === 0) return <p className="hm-panel hm-muted">No unread email. Nice.</p>;
  return (
    <>
      <p className="hm-peek-summary">
        {peek.unreadCount} unread{peek.unreadCount > peek.messages.length ? `, showing the newest ${peek.messages.length}` : ''}
      </p>
      <ul className="hm-list" aria-label="Unread email">
        {peek.messages.map((message, index) => (
          <li key={index} className="hm-item hm-result-row" onClick={() => onOpen(message.url || peek.inboxUrl)}>
            <span className="hm-result-title">
              {message.from} <span className="hm-muted">· {relativeTime(message.date)}</span>
            </span>
            <span className="hm-peek-subject">{message.subject}</span>
            {message.snippet && <span className="hm-result-snippet">{message.snippet}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

function CalendarList({ events, onOpen }: { events: CalendarEvent[]; onOpen: (url: string) => void }) {
  if (events.length === 0) return <p className="hm-panel hm-muted">Nothing on your calendar for the next two days.</p>;
  let lastDay = '';
  return (
    <ul className="hm-list" aria-label="Upcoming events">
      {events.map((event, index) => {
        const day = dayLabel(event);
        const header = day !== lastDay ? day : null;
        lastDay = day;
        return (
          <li key={index} className="hm-peek-event">
            {header && <span className="hm-subhead">{header}</span>}
            <span className="hm-peek-event-row">
              <span className="hm-peek-time">{event.allDay ? 'All day' : timeRange(event)}</span>
              <span className="hm-peek-event-text">
                <span className="hm-result-title">{event.title}</span>
                {event.location && <span className="hm-result-snippet">{event.location}</span>}
              </span>
              {event.meetingUrl && (
                <button className="hm-button" onClick={() => onOpen(event.meetingUrl)}>
                  Join
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function dayLabel(event: CalendarEvent): string {
  // All-day events are dates, not instants: read them in UTC so they don't shift a day.
  const date = new Date(event.start);
  const today = new Date();
  const key = (d: Date, utc: boolean) => (utc ? d.toISOString().slice(0, 10) : d.toLocaleDateString('en-CA'));
  const eventKey = key(date, event.allDay);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (eventKey === key(today, false)) return 'Today';
  if (eventKey === key(tomorrow, false)) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: event.allDay ? 'UTC' : undefined });
}

function timeRange(event: CalendarEvent): string {
  const format = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${format(event.start)}–${format(event.end)}`;
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
