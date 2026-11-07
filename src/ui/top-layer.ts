/**
 * Put a host element in the browser's top layer (popover="manual"), above every z-index on the
 * page and above popovers or dialogs the page opened earlier. Manual popovers don't light-dismiss,
 * close on Esc, or move focus, so the UI keeps its own behavior. The UA's popover box styles are
 * reset so the host is just a transparent layer.
 */
export function showInTopLayer(
  host: HTMLElement,
  box: "fullscreen" | "point",
): void {
  if (typeof host.showPopover !== "function") return;
  host.setAttribute("popover", "manual");
  Object.assign(host.style, {
    margin: "0",
    padding: "0",
    border: "0",
    background: "transparent",
    overflow: "visible",
    maxWidth: "none",
    maxHeight: "none",
    color: "inherit",
    ...(box === "fullscreen"
      ? { position: "fixed", inset: "0", width: "100%", height: "100%" }
      : { position: "fixed", inset: "0 auto auto 0", width: "0", height: "0" }),
  });
  try {
    if (!host.matches(":popover-open")) host.showPopover();
  } catch {
    // Not connected yet or popovers unsupported; the z-index fallback still applies.
  }
}
