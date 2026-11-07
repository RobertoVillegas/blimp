export interface DocumentSummaryInput {
  title: string;
  description: string;
  siteName: string;
  text: string;
  hasPasswordField: boolean;
}

const SKIP =
  'script,style,noscript,template,svg,canvas,iframe,object,embed,nav,header,footer,aside,form,button,dialog,[hidden],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="contentinfo"],[role="complementary"],[style*="display:none"],[style*="display: none"]';

/**
 * Readable text from a parsed (not rendered) document, for link previews. DOMParser documents
 * never run scripts, and there is no layout, so visibility comes from markup only.
 */
export function extractFromDocument(doc: Document, maxChars: number): DocumentSummaryInput {
  const meta = (selector: string) => doc.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? '';
  const hasPasswordField = doc.querySelector('input[type="password"]') !== null;

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
  };
}
