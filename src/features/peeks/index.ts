import { UserFacingError } from "@/shared/errors";
import type { CalendarEvent, GmailPeek } from "@/shared/types";
import { getApiKey } from "@/storage/secrets";
import { loadSettings } from "@/storage/settings";
import { fetchCalendar } from "./calendar";
import {
  GMAIL_ORIGIN,
  accountFromUrl,
  fetchGmail,
  gmailInboxUrl,
} from "./gmail";

export const CALENDAR_SECRET_ID = "calendar:ics";
const MEETING_HOSTS =
  /(^|\.)(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|whereby\.com|webex\.com)$/;

/** e2e builds read Gmail from the fixture server; real builds always use mail.google.com. */
async function gmailBase(): Promise<string | undefined> {
  if (import.meta.env.MODE !== "e2e") return undefined;
  return (await browser.storage.local.get("e2e:gmailBase"))["e2e:gmailBase"] as
    string | undefined;
}

export async function gmailPeek(): Promise<GmailPeek & { inboxUrl: string }> {
  const settings = await loadSettings();
  if (!settings.peeks.gmail)
    throw new UserFacingError(
      "not-configured",
      "Turn on Gmail in Settings › Peeks first.",
    );
  const base = await gmailBase();
  if (
    !base &&
    !(await browser.permissions.contains({ origins: [GMAIL_ORIGIN] }))
  ) {
    throw new UserFacingError(
      "permission",
      "Blimp needs access to mail.google.com. Turn Gmail on again in Settings › Peeks.",
    );
  }
  const [gmailTab] = await browser.tabs.query({
    url: "https://mail.google.com/mail/*",
  });
  const account = accountFromUrl(gmailTab?.url);
  return {
    ...(await fetchGmail(account, { base })),
    inboxUrl: gmailInboxUrl(account, base),
  };
}

export async function calendarPeek(): Promise<CalendarEvent[]> {
  const url = await getApiKey(CALENDAR_SECRET_ID);
  if (!url)
    throw new UserFacingError(
      "not-configured",
      "Add your calendar's secret iCal address in Settings › Peeks first.",
    );
  return fetchCalendar(url);
}

/**
 * Open a link from a peek. Only Gmail, Google Calendar and known meeting hosts are allowed, so
 * a feed can't send the browser anywhere else. Reuses the open Gmail or Calendar tab.
 */
export async function openPeekLink(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UserFacingError("invalid-output", "That link is not valid.");
  }
  const e2e =
    import.meta.env.MODE.startsWith("e2e") && parsed.hostname === "127.0.0.1";
  const host = parsed.hostname;
  const allowed =
    parsed.protocol === "https:" &&
    (host === "mail.google.com" ||
      host === "calendar.google.com" ||
      MEETING_HOSTS.test(host));
  if (!allowed && !e2e)
    throw new UserFacingError(
      "invalid-output",
      "Blimp only opens Gmail, Calendar and meeting links from a peek.",
    );

  const reuse =
    host === "mail.google.com"
      ? "https://mail.google.com/*"
      : host === "calendar.google.com"
        ? "https://calendar.google.com/*"
        : null;
  const [existing] = reuse ? await browser.tabs.query({ url: reuse }) : [];
  if (existing?.id !== undefined) {
    await browser.tabs.update(existing.id, { url, active: true });
    if (existing.windowId !== undefined)
      await browser.windows.update(existing.windowId, { focused: true });
  } else {
    await browser.tabs.create({ url, active: true });
  }
}
