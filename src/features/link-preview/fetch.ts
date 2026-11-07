import { isHttpUrl } from "@/shared/url";
import { isPrivateHost } from "./guard";

export const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 8_000;

export type FetchedPage =
  | { kind: "html"; html: string; finalUrl: string }
  | { kind: "unavailable"; reason: string; finalUrl: string };

/**
 * Download a page for a preview without cookies (signed-in content stays private), with a
 * size cap and timeout. Redirects are followed, but a final URL on a private network is refused.
 */
export async function fetchPreviewHtml(
  url: string,
  {
    signal,
    allowPrivate = false,
    fetchImpl = fetch,
  }: {
    signal?: AbortSignal;
    allowPrivate?: boolean;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<FetchedPage> {
  const blocked = (target: string) =>
    !isHttpUrl(target) ||
    (!allowPrivate && isPrivateHost(new URL(target).hostname));
  if (blocked(url))
    return {
      kind: "unavailable",
      reason: "Local or non-web address",
      finalUrl: url,
    };

  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      credentials: "omit",
      redirect: "follow",
      headers: { accept: "text/html,application/xhtml+xml" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    signal?.throwIfAborted();
    return {
      kind: "unavailable",
      reason: timeout.aborted
        ? "The site took too long"
        : "The site could not be reached",
      finalUrl: url,
    };
  }

  const finalUrl = response.url || url;
  if (blocked(finalUrl))
    return {
      kind: "unavailable",
      reason: "Redirected to a local address",
      finalUrl,
    };
  if (!response.ok) {
    return {
      kind: "unavailable",
      reason:
        response.status === 401 || response.status === 403
          ? "Needs sign-in or blocks previews"
          : `The site answered HTTP ${response.status}`,
      finalUrl,
    };
  }
  const type = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
    const kind = type.split(";")[0]?.trim() || "unknown type";
    return {
      kind: "unavailable",
      reason: `Not a web page (${kind})`,
      finalUrl,
    };
  }

  const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? "utf-8";
  return { kind: "html", html: await readCapped(response, charset), finalUrl };
}

export const MAX_IMAGE_BYTES = 1_000_000;
const IMAGE_TYPES = /^image\/(png|jpeg|webp|gif|avif)$/i;

/**
 * Download a preview image without cookies or a referrer, behind the same private-network guard,
 * and return it as a data URL so the card never makes the page load third-party URLs.
 */
export async function fetchPreviewImage(
  url: string,
  {
    signal,
    allowPrivate = false,
    fetchImpl = fetch,
  }: {
    signal?: AbortSignal;
    allowPrivate?: boolean;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<string | null> {
  const blocked = (target: string) =>
    !isHttpUrl(target) ||
    (!allowPrivate && isPrivateHost(new URL(target).hostname));
  if (blocked(url)) return null;
  const timeout = AbortSignal.timeout(6_000);
  try {
    const response = await fetchImpl(url, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
      },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim();
    if (!response.ok || blocked(response.url || url) || !IMAGE_TYPES.test(type))
      return null;
    if (Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES)
      return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type.toLowerCase()};base64,${btoa(binary)}`;
  } catch {
    signal?.throwIfAborted();
    return null;
  }
}

async function readCapped(
  response: Response,
  charset: string,
): Promise<string> {
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder();
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  let html = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (bytes >= MAX_HTML_BYTES) {
      await reader.cancel();
      // A single chunk can overshoot the cap, so trim what was decoded.
      return html.slice(0, MAX_HTML_BYTES);
    }
  }
  return html + decoder.decode();
}
