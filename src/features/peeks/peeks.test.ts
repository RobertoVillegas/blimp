import { describe, expect, it, vi } from "vitest";
import { upcomingEvents } from "./calendar";
import { accountFromUrl, fetchGmail, parseGmailAtom } from "./gmail";

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed version="0.3" xmlns="http://purl.org/atom/ns#">
<title>Gmail - Inbox for you@example.com</title>
<fullcount>7</fullcount>
<entry>
<title>Invoice &amp; receipt for November</title>
<summary>Thanks for your order &#8212; your total was $42.</summary>
<link rel="alternate" href="https://mail.google.com/mail/u/0?account_id=you%40example.com&amp;message_id=abc&amp;view=conv" type="text/html" />
<modified>2026-11-07T08:00:00Z</modified><issued>2026-11-07T08:00:00Z</issued>
<author><name>Acme Billing</name><email>billing@acme.com</email></author>
</entry>
<entry>
<title></title><summary>no subject here</summary>
<link rel="alternate" href="javascript:alert(1)" type="text/html" />
<author><email>someone@example.com</email></author>
</entry>
</feed>`;

describe("Gmail feed", () => {
  it("reads count, sender, subject and safe links", () => {
    const peek = parseGmailAtom(ATOM);
    expect(peek.unreadCount).toBe(7);
    expect(peek.messages[0]).toEqual({
      subject: "Invoice & receipt for November",
      snippet: "Thanks for your order — your total was $42.",
      from: "Acme Billing",
      date: "2026-11-07T08:00:00Z",
      url: "https://mail.google.com/mail/u/0?account_id=you%40example.com&message_id=abc&view=conv",
    });
    expect(peek.messages[1]).toMatchObject({
      subject: "(no subject)",
      from: "someone@example.com",
      url: "",
    });
  });

  it("uses the browser session and explains a signed-out account", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("", { status: 401 }),
    );
    await expect(fetchGmail(1, { fetchImpl })).rejects.toThrow(
      /Not signed in to Gmail account 1/,
    );
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://mail.google.com/mail/u/1/feed/atom",
    );
    expect(fetchImpl.mock.calls[0]![1]!.credentials).toBe("include");
  });

  it("follows the account of the open Gmail tab", () => {
    expect(accountFromUrl("https://mail.google.com/mail/u/2/#inbox")).toBe(2);
    expect(accountFromUrl("https://example.com")).toBe(0);
  });
});

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VTIMEZONE
TZID:America/Mexico_City
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:-0600
TZOFFSETTO:-0600
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:standup
SUMMARY:Standup
DTSTART;TZID=America/Mexico_City:20261102T100000
DTEND;TZID=America/Mexico_City:20261102T101500
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
DESCRIPTION:Join https://meet.google.com/abc-defg-hij
END:VEVENT
BEGIN:VEVENT
UID:standup
RECURRENCE-ID;TZID=America/Mexico_City:20261110T100000
SUMMARY:Standup (moved)
DTSTART;TZID=America/Mexico_City:20261110T120000
DTEND;TZID=America/Mexico_City:20261110T121500
END:VEVENT
BEGIN:VEVENT
UID:offsite
SUMMARY:Team offsite
DTSTART;VALUE=DATE:20261110
DTEND;VALUE=DATE:20261111
END:VEVENT
BEGIN:VEVENT
UID:cancelled
SUMMARY:Cancelled thing
STATUS:CANCELLED
DTSTART:20261109T180000Z
DTEND:20261109T190000Z
END:VEVENT
BEGIN:VEVENT
UID:past
SUMMARY:Already over
DTSTART:20261101T180000Z
DTEND:20261101T190000Z
END:VEVENT
END:VCALENDAR`;

describe("calendar", () => {
  // Monday Nov 9 2026, 12:00 UTC = 06:00 in Mexico City.
  const now = new Date("2026-11-09T12:00:00Z");

  it("expands recurrences, applies moved occurrences and time zones, and skips cancelled and past events", () => {
    const events = upcomingEvents(ICS, now, 48);
    expect(events.map((e) => [e.title, e.start])).toEqual([
      ["Standup", "2026-11-09T16:00:00.000Z"],
      ["Team offsite", expect.stringMatching(/^2026-11-1[01]T/)],
      ["Standup (moved)", "2026-11-10T18:00:00.000Z"],
    ]);
    expect(events[0]!.meetingUrl).toBe("https://meet.google.com/abc-defg-hij");
    expect(events.find((e) => e.title === "Team offsite")!.allDay).toBe(true);
  });

  it("rejects something that is not a calendar", () => {
    expect(() => upcomingEvents("<html>login</html>", now)).toThrow(/iCal/);
  });
});
