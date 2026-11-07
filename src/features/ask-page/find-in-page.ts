import { normalizeForMatch } from '@/shared/quotes';

/**
 * Select and scroll to `quote` on the current page, matching across element boundaries the same
 * way quotes are verified. Runs in the page (the in-page palette). Returns whether it was found.
 */
export function showQuoteOnPage(quote: string, skip?: Element): boolean {
  const target = normalizeForMatch(quote);
  if (!target) return false;

  // Build the page's visible text with a map back to (node, offset), collapsing whitespace.
  const chars: { node: Text; offset: number }[] = [];
  let text = '';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent || parent.closest('script, style, noscript, template') || (skip && skip.contains(parent))) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const value = node.data;
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeForMatch(value[i]!) || ' ';
      if (normalized === ' ' && text.endsWith(' ')) continue;
      text += normalized;
      chars.push({ node, offset: i });
    }
    if (!text.endsWith(' ')) {
      text += ' ';
      chars.push({ node, offset: value.length });
    }
  }

  const start = text.indexOf(target);
  if (start === -1) return false;
  const first = chars[start]!;
  const last = chars[start + target.length - 1]!;
  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, Math.min(last.offset + 1, last.node.length));
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  first.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}
