export const REPO = 'RobertoVillegas/helium-max';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=10`;
const RELEASE_PAGE_PREFIX = `https://github.com/${REPO}/releases/`;

export interface AvailableUpdate {
  version: string;
  pageUrl: string;
  downloadUrl: string;
}

/** Compare dotted numeric versions ("0.10.0" > "0.9.3"). Non-numeric parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

interface RawRelease {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: { name?: unknown; browser_download_url?: unknown }[];
}

/**
 * Newest published release above `current`, or null. Only links into this repository's
 * release pages are accepted, so a tampered response can't point the user elsewhere.
 */
export function pickUpdate(releases: RawRelease[], current: string): AvailableUpdate | null {
  let best: AvailableUpdate | null = null;
  for (const release of releases) {
    if (release.draft || release.prerelease || typeof release.tag_name !== 'string') continue;
    const version = release.tag_name.replace(/^v/, '');
    if (!/^\d+(\.\d+)*$/.test(version) || compareVersions(version, current) <= 0) continue;
    if (best && compareVersions(version, best.version) <= 0) continue;
    const pageUrl = typeof release.html_url === 'string' ? release.html_url : '';
    const asset = release.assets?.find((item) => typeof item.name === 'string' && /^helium-max-[\d.]+-chrome\.zip$/.test(item.name));
    const downloadUrl = typeof asset?.browser_download_url === 'string' ? asset.browser_download_url : pageUrl;
    if (!pageUrl.startsWith(RELEASE_PAGE_PREFIX) || !downloadUrl.startsWith(RELEASE_PAGE_PREFIX)) continue;
    best = { version, pageUrl, downloadUrl };
  }
  return best;
}

export async function fetchUpdate(current: string, fetchImpl: typeof fetch = fetch): Promise<AvailableUpdate | null> {
  const response = await fetchImpl(RELEASES_API, {
    headers: { accept: 'application/vnd.github+json' },
    credentials: 'omit',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub answered HTTP ${response.status}`);
  const body = (await response.json()) as unknown;
  return Array.isArray(body) ? pickUpdate(body as RawRelease[], current) : null;
}
