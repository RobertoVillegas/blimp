import { UserFacingError } from "@/shared/errors";
import { isHttpUrl } from "@/shared/url";

/** Little Blimp: Arc's Little Arc, as a small popup-type window (no tab strip, minimal bar). */
const WINDOWS_KEY = "little:windows";
const BOUNDS_KEY = "little:bounds";
const DEFAULT_SIZE = { width: 560, height: 720 };

type Bounds = { width: number; height: number; left?: number; top?: number };

/** Windows still settling into their size; their bounds events aren't the user's choice. */
const settling = new Set<number>();
const SETTLE_MS = 1_500;

async function trackedIds(): Promise<number[]> {
  return (
    ((await browser.storage.session.get(WINDOWS_KEY))[WINDOWS_KEY] as
      number[] | undefined) ?? []
  );
}

async function setTracked(ids: number[]): Promise<void> {
  await browser.storage.session.set({ [WINDOWS_KEY]: ids });
}

export async function isLittleWindow(
  windowId: number | undefined,
): Promise<boolean> {
  return windowId !== undefined && (await trackedIds()).includes(windowId);
}

/** Open a Little Blimp window with a page, or with its quick-search start page. */
export async function openLittle(url?: string): Promise<number> {
  if (url && !isHttpUrl(url))
    throw new UserFacingError(
      "invalid-output",
      "Only web pages can open in Little Blimp.",
    );
  const saved = (await browser.storage.local.get(BOUNDS_KEY))[BOUNDS_KEY] as
    Bounds | undefined;
  let bounds = saved ?? (await centeredBounds());
  const create = (b: Bounds) =>
    browser.windows.create({
      url: url ?? browser.runtime.getURL("/little.html"),
      type: "popup",
      focused: true,
      ...b,
    });
  let created: Browser.windows.Window | undefined;
  try {
    created = await create(bounds);
  } catch {
    // The saved spot is off screen now (a monitor was unplugged): open centered at the saved size.
    bounds = {
      ...(await centeredBounds()),
      width: saved?.width ?? DEFAULT_SIZE.width,
      height: saved?.height ?? DEFAULT_SIZE.height,
    };
    created = await create(bounds).catch(() => create(DEFAULT_SIZE));
    if (created)
      bounds = {
        width: created.width ?? bounds.width,
        height: created.height ?? bounds.height,
      };
  }
  if (created?.id === undefined)
    throw new UserFacingError(
      "internal",
      "The browser did not open the window.",
    );
  const id = created.id;
  settling.add(id);
  setTimeout(() => settling.delete(id), SETTLE_MS);
  await setTracked([...(await trackedIds()), id]);
  // Some browsers ignore the size on creation; apply it again.
  if (created.width !== bounds.width || created.height !== bounds.height) {
    await browser.windows
      .update(id, { width: bounds.width, height: bounds.height })
      .catch(() => undefined);
  }
  return id;
}

/** Move the Little Blimp tab into the main window, keeping its state; the little window closes. */
export async function moveToMainWindow(tabId: number): Promise<void> {
  const tab = await browser.tabs.get(tabId);
  if (!(await isLittleWindow(tab.windowId)))
    throw new UserFacingError(
      "nothing-to-do",
      "This tab is already in a main window.",
    );
  const [main] = await browser.windows
    .getAll({ windowTypes: ["normal"] })
    .then((windows) =>
      windows.sort((a, b) => Number(b.focused) - Number(a.focused)),
    );
  if (main?.id === undefined) {
    // No main window open: make one around this tab.
    await browser.windows.create({ tabId, type: "normal", focused: true });
    return;
  }
  await browser.tabs.move(tabId, { windowId: main.id, index: -1 });
  await browser.tabs.update(tabId, { active: true });
  await browser.windows.update(main.id, { focused: true });
}

export async function closeLittleWindows(): Promise<number> {
  const ids = await trackedIds();
  let closed = 0;
  for (const id of ids) {
    if (
      await browser.windows.remove(id).then(
        () => true,
        () => false,
      )
    )
      closed++;
  }
  await setTracked([]);
  return closed;
}

/** Remember where the user puts and how they size Little Blimp; forget closed windows. */
export function registerLittleWindows(): void {
  browser.windows.onBoundsChanged?.addListener(async (window) => {
    if (
      window.id === undefined ||
      settling.has(window.id) ||
      !(await isLittleWindow(window.id))
    )
      return;
    const { width, height, left, top } = window;
    if (width && height)
      await browser.storage.local.set({
        [BOUNDS_KEY]: { width, height, left, top },
      });
  });
  browser.windows.onRemoved.addListener(async (id) => {
    const ids = await trackedIds();
    if (ids.includes(id))
      await setTracked(ids.filter((tracked) => tracked !== id));
  });
}

async function centeredBounds(): Promise<Bounds> {
  const current = await browser.windows.getLastFocused().catch(() => undefined);
  if (
    !current?.width ||
    current.left === undefined ||
    current.top === undefined
  )
    return DEFAULT_SIZE;
  return {
    ...DEFAULT_SIZE,
    left: Math.round(current.left + (current.width - DEFAULT_SIZE.width) / 2),
    top: current.top + 60,
  };
}

/** What the start page's box does with what was typed: open it as an address, or search it. */
export function addressFor(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  if (/^https?:\/\//i.test(text)) return isHttpUrl(text) ? text : null;
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/.*)?$/i.test(text))
    return `https://${text}`;
  return null;
}
