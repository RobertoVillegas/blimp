import ICAL from 'ical.js';
import { UserFacingError } from '@/shared/errors';
import type { CalendarEvent } from '@/shared/types';

const MEETING_URL = /https:\/\/(?:meet\.google\.com|[\w-]+\.zoom\.us|zoom\.us|teams\.microsoft\.com|teams\.live\.com|whereby\.com|[\w-]+\.webex\.com)\/[^\s"<>)]+/i;

/**
 * Upcoming events from an iCal feed (Google Calendar's "secret address in iCal format"),
 * expanding recurring events and converting time zones, between `now` and `now + hours`.
 */
export function upcomingEvents(icsText: string, now: Date, hours = 48, limit = 12): CalendarEvent[] {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(icsText));
  } catch {
    throw new UserFacingError('invalid-output', 'That address did not return a calendar in iCal format.');
  }
  // Register the feed's time zones so TZID times convert correctly.
  for (const zone of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(zone);

  const windowEnd = new Date(now.getTime() + hours * 3_600_000);
  const results: CalendarEvent[] = [];
  const vevents = root.getAllSubcomponents('vevent');
  // Exceptions to recurring events (RECURRENCE-ID) replace the occurrence they point to.
  const exceptions = vevents.filter((component) => component.hasProperty('recurrence-id'));

  for (const component of vevents) {
    if (component.hasProperty('recurrence-id')) continue;
    const event = new ICAL.Event(component);
    for (const exception of exceptions) if (exception.getFirstPropertyValue('uid') === event.uid) event.relateException(exception);

    const push = (start: ICAL.Time, end: ICAL.Time, details: ICAL.Event) => {
      const startDate = start.toJSDate();
      const endDate = end.toJSDate();
      if (endDate <= now || startDate >= windowEnd) return;
      if (details.component.getFirstPropertyValue('status') === 'CANCELLED') return;
      const text = [details.location, details.description, details.component.getFirstPropertyValue('url')].filter(Boolean).join(' ');
      results.push({
        title: details.summary || '(no title)',
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        allDay: start.isDate,
        location: details.location || '',
        meetingUrl: MEETING_URL.exec(text)?.[0] ?? '',
      });
    };

    if (event.isRecurring()) {
      const iterator = event.iterator();
      for (let next = iterator.next(), guard = 0; next && guard < 2000; next = iterator.next(), guard++) {
        if (next.toJSDate() >= windowEnd) break;
        const occurrence = event.getOccurrenceDetails(next);
        push(occurrence.startDate, occurrence.endDate, occurrence.item);
      }
    } else {
      push(event.startDate, event.endDate ?? event.startDate, event);
    }
  }
  return results.sort((a, b) => a.start.localeCompare(b.start)).slice(0, limit);
}

export async function fetchCalendar(url: string, now = new Date(), fetchImpl: typeof fetch = fetch): Promise<CalendarEvent[]> {
  let response: Response;
  try {
    // The address itself is the secret; no cookies needed.
    response = await fetchImpl(url, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new UserFacingError('network', 'Could not reach your calendar.');
  }
  if (response.status === 404 || response.status === 403 || response.status === 401) {
    throw new UserFacingError('auth', 'The calendar address was rejected. Copy the secret iCal address again from Google Calendar settings.');
  }
  if (!response.ok) throw new UserFacingError('network', `The calendar answered HTTP ${response.status}.`);
  return upcomingEvents(await response.text(), now);
}
