export interface DocumentSummaryInput {
  title: string;
  description: string;
  siteName: string;
  text: string;
  hasPasswordField: boolean;
  /** The page's own share image (og:image) or its first sizeable article image, absolute. */
  imageUrl?: string;
}

const SKIP =
  'script,style,noscript,template,svg,canvas,iframe,object,embed,nav,header,footer,aside,form,button,dialog,[hidden],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="contentinfo"],[role="complementary"],[style*="display:none"],[style*="display: none"]';

/**
 * Readable text from a parsed (not rendered) document, for link previews. DOMParser documents
 * never run scripts, and there is no layout, so visibility comes from markup only.
 */
export function extractFromDocument(doc: Document, maxChars: number, baseUrl: string): DocumentSummaryInput {
  const meta = (selector: string) => doc.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? '';
  const hasPasswordField = doc.querySelector('input[type="password"]') !== null;
  const imageUrl = pickImage(doc, baseUrl, meta);

  for (const el of doc.querySelectorAll(SKIP)) el.remove();
  const candidates = [...doc.querySelectorAll<HTMLElement>('article, main, [role="main"]')];
  const length = (el: Element) => el.textContent?.length ?? 0;
  const best = candidates.sort((a, b) => length(b) - length(a))[0];
  const root = best && length(best) > 300 ? best : doc.body;

  const blocks: string[] = [];
  let total = 0;
  for (const el of root?.querySelectorAll('h1, h2, h3, p, li, blockquote, pre, td, dd') ?? []) {
    // Nested matches (p inside li) would repeat text; keep the innermost block only.
    if (el.querySelector('p, li, blockquote, pre')) continue;
    const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (text.length < 2) continue;
    blocks.push(/^H[1-3]$/.test(el.tagName) ? `## ${text}` : text);
    total += text.length;
    if (total >= maxChars) break;
  }
  const text = (blocks.length ? blocks.join('\n') : (root?.textContent ?? '').replace(/\s+/g, ' ')).trim();

  return {
    title: meta('meta[property="og:title"]') || doc.title.trim(),
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    siteName: meta('meta[property="og:site_name"]'),
    text: text.slice(0, maxChars),
    hasPasswordField,
    imageUrl,
  };
}

const NOT_CONTENT = /logo|icon|avatar|sprite|badge|pixel|tracking|spacer|emoji/i;

/** og:image first (what the site chose for sharing), else the first sizeable image in the content. */
function pickImage(doc: Document, baseUrl: string, meta: (selector: string) => string): string | undefined {
  const absolute = (value: string | null | undefined) => {
    if (!value) return undefined;
    try {
      const url = new URL(value, baseUrl);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
    } catch {
      return undefined;
    }
  };
  const shared =
    meta('meta[property="og:image"]') ||
    meta('meta[property="og:image:url"]') ||
    meta('meta[name="twitter:image"]') ||
    meta('meta[name="twitter:image:src"]') ||
    doc.querySelector<HTMLLinkElement>('link[rel="image_src"]')?.getAttribute('href');
  if (absolute(shared)) return absolute(shared);

  const scope = doc.querySelector('article, main, [role="main"]') ?? doc.body;
  for (const img of scope?.querySelectorAll('img') ?? []) {
    const src = img.getAttribute('src') ?? img.getAttribute('data-src');
    const width = Number(img.getAttribute('width')) || 0;
    const height = Number(img.getAttribute('height')) || 0;
    if (!src || src.startsWith('data:') || /\.svg(\?|$)/i.test(src)) continue;
    if ((width && width < 200) || (height && height < 120)) continue;
    if (NOT_CONTENT.test(`${src} ${img.getAttribute('alt') ?? ''} ${img.className}`)) continue;
    return absolute(src);
  }
  return undefined;
}
