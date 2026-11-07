function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** True only for http(s) URLs; every other scheme is refused for previews and navigation. */
export function isHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  const url = parseUrl(value);
  return (
    url !== null && (url.protocol === "http:" || url.protocol === "https:")
  );
}

/** Pages where an extension cannot inject a content script, so the palette falls back to a popup. */
export function canInjectInto(url: string | undefined): boolean {
  if (!isHttpUrl(url)) return false;
  const host = parseUrl(url!)!.hostname;
  return host !== "chromewebstore.google.com" && host !== "chrome.google.com";
}

export function domainOf(value: string | undefined): string {
  if (!value) return "";
  return parseUrl(value)?.hostname.replace(/^www\./, "") ?? "";
}

/** Origin match pattern (e.g. `https://api.openai.com/*`) for a permission request. */
export function originPattern(value: string): string | null {
  const url = parseUrl(value);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:"))
    return null;
  return `${url.protocol}//${url.hostname}/*`;
}

/**
 * Where user data may be sent: https anywhere, or plain http only to this machine (Ollama,
 * local servers). The Chrome Web Store requires user data to travel encrypted.
 */
export function isSecureEndpoint(value: string): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  if (url.protocol === "https:") return true;
  return (
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  );
}
