export interface ExtractedPage {
  title: string;
  url: string;
  lang: string;
  description: string;
  headings: string[];
  text: string;
}

/**
 * Runs inside the page through `scripting.executeScript`, so it must be self-contained:
 * no imports, no closures over module scope.
 * Reads visible text from the main content area and skips navigation, ads, forms and
 * anything hidden. Form values and password fields are never read.
 */
export function extractPageContent(maxChars: number): ExtractedPage {
  const SKIP =
    'script,style,noscript,template,svg,canvas,iframe,object,embed,nav,header,footer,aside,form,input,textarea,select,button,dialog,[hidden],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="contentinfo"],[role="complementary"],[role="search"],[contenteditable="true"],.ad,.ads,.advert,.advertisement,[id^="ad-"],[class*="cookie"],[class*="newsletter"]';
  const BLOCK = /^(P|DIV|SECTION|ARTICLE|MAIN|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|TABLE|TR|TD|TH|DD|DT|FIGCAPTION|BR|HR)$/;

  const meta = (selector: string) =>
    document.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? '';

  const candidates = [
    ...document.querySelectorAll<HTMLElement>('article, main, [role="main"], #content, .content, .post, .article'),
  ];
  const textLength = (el: HTMLElement) => el.innerText?.length ?? 0;
  const best = candidates.sort((a, b) => textLength(b) - textLength(a))[0];
  const root = best && textLength(best) > 500 ? best : document.body;

  const visible = new WeakMap<Element, boolean>();
  const isVisible = (el: Element): boolean => {
    const cached = visible.get(el);
    if (cached !== undefined) return cached;
    const result =
      !el.closest(SKIP) &&
      (typeof (el as HTMLElement).checkVisibility !== 'function' ||
        (el as HTMLElement).checkVisibility({ visibilityProperty: true, opacityProperty: true }));
    visible.set(el, result);
    return result;
  };

  const parts: string[] = [];
  let length = 0;
  let lastBlock: Element | null = null;
  const walker = document.createTreeWalker(root ?? document.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && length < maxChars; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || !isVisible(parent)) continue;
    const text = node.textContent?.replace(/\s+/g, ' ') ?? '';
    if (!text.trim()) continue;
    let block: Element | null = parent;
    while (block && block !== root && !BLOCK.test(block.tagName)) block = block.parentElement;
    if (block !== lastBlock) {
      parts.push('\n');
      if (block && /^H[1-6]$/.test(block.tagName)) parts.push('#'.repeat(Number(block.tagName[1])) + ' ');
      lastBlock = block;
    }
    parts.push(text);
    length += text.length;
  }

  const headings = [...(root ?? document.body).querySelectorAll<HTMLElement>('h1, h2, h3')]
    .filter((h) => isVisible(h))
    .map((h) => h.innerText.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 40);

  return {
    title: document.title,
    url: location.href,
    lang: document.documentElement.lang,
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    headings,
    text: parts
      .join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, maxChars),
  };
}
