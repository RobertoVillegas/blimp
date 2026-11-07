/**
 * Hosts Helium Max must not fetch for previews: loopback, private and link-local ranges,
 * CGNAT (which includes Tailscale), and local-only names. Webpages can't use previews to
 * make the extension probe your network.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (/\.(local|internal|lan|home|arpa|ts\.net)$/.test(host) || !host.includes('.') && !host.includes(':')) return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (host.includes(':')) {
    return host === '::' || host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('::ffff:');
  }
  return false;
}

/** Cache key: no fragment, no tracking parameters, lowercase host. */
export function normalizePreviewUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_|ref_src$)/.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}
