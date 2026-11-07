import { extractFromDocument } from '@/features/link-preview/extract-document';
import { send } from '@/shared/send';
import type { LinkPreview } from '@/shared/types';
import { domainOf, isHttpUrl } from '@/shared/url';
import { CARD_CSS } from '@/ui/preview-card-css';

const DEBOUNCE_MS = 400;
const LEAVE_GRACE_MS = 250;
const MAX_TEXT_CHARS = 16_000;

// Registered at runtime only while Shift-hover previews are on (see syncLinkPreviewScript).
// Plain DOM, no React: this runs on every page the user grants.
export default defineContentScript({
  registration: 'runtime',
  matches: ['http://*/*', 'https://*/*'],
  cssInjectionMode: 'manual',

  main(ctx) {
    let shiftDown = false;
    let hovered: HTMLAnchorElement | null = null;
    let pointer = { x: 0, y: 0 };
    let pending: ReturnType<typeof setTimeout> | undefined;
    let leaving: ReturnType<typeof setTimeout> | undefined;
    let current: { url: string; opId: string } | null = null;
    let card: Card | null = null;

    const eligible = (anchor: HTMLAnchorElement | null): string | null => {
      if (!anchor || anchor.isContentEditable) return null;
      const url = anchor.href;
      if (!isHttpUrl(url)) return null;
      if (url.split('#')[0] === location.href.split('#')[0]) return null;
      // Holding Shift while typing must never fetch anything.
      const focused = document.activeElement as HTMLElement | null;
      if (focused?.isContentEditable || focused?.matches('input, textarea, select')) return null;
      return url;
    };

    const schedule = () => {
      clearTimeout(pending);
      if (!shiftDown || !eligible(hovered)) return;
      const anchor = hovered;
      pending = setTimeout(() => anchor === hovered && shiftDown && void show(anchor!), DEBOUNCE_MS);
    };

    const dismiss = () => {
      clearTimeout(pending);
      clearTimeout(leaving);
      if (current) void send({ type: 'op/cancel', opId: current.opId }).catch(() => undefined);
      current = null;
      card?.remove();
      card = null;
    };

    const show = async (anchor: HTMLAnchorElement) => {
      const url = eligible(anchor);
      if (!url || current?.url === url) return;
      dismiss();
      const opId = crypto.randomUUID();
      current = { url, opId };
      card = new Card(url, anchor.textContent?.trim() || domainOf(url), dismiss, (inside) => {
        if (inside) clearTimeout(leaving);
        else leaveSoon();
      });
      card.place(pointer.x, pointer.y);

      const stillCurrent = () => current?.opId === opId;
      try {
        const start = await send({ type: 'preview/start', opId, url });
        if (!stillCurrent()) return;
        let preview: LinkPreview;
        if (start.kind === 'done') {
          preview = start.preview;
        } else {
          const doc = new DOMParser().parseFromString(start.html, 'text/html');
          const page = extractFromDocument(doc, MAX_TEXT_CHARS, start.finalUrl);
          preview = await send({ type: 'preview/finish', opId, page: { ...page, url, finalUrl: start.finalUrl } });
        }
        if (!stillCurrent()) return;
        card?.render(preview);
        if (preview.imageUrl) {
          const image = await send({ type: 'preview/image', opId, url: preview.imageUrl });
          if (image && stillCurrent()) card?.setImage(image);
        }
      } catch (error) {
        if (stillCurrent()) card?.renderError(error instanceof Error ? error.message : 'Preview unavailable');
      }
    };

    const leaveSoon = () => {
      clearTimeout(leaving);
      leaving = setTimeout(() => {
        if (!card?.hovered && !hovered) dismiss();
      }, LEAVE_GRACE_MS);
    };

    // Only real user input counts; pages can't synthesize Shift-hover to spend the user's tokens.
    ctx.addEventListener(window, 'keydown', (event) => {
      if (!event.isTrusted) return;
      if (event.key === 'Escape' && card) {
        dismiss();
        return;
      }
      if (event.key === 'Shift' && !event.repeat) {
        shiftDown = true;
        schedule();
      }
    }, { capture: true });

    ctx.addEventListener(window, 'keyup', (event) => {
      if (!event.isTrusted || event.key !== 'Shift') return;
      shiftDown = false;
      clearTimeout(pending);
      if (card && !card.hovered) dismiss();
    }, { capture: true });

    ctx.addEventListener(document, 'pointerover', (event) => {
      if (!event.isTrusted) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (anchor === hovered) return;
      hovered = anchor;
      shiftDown = event.shiftKey;
      if (anchor) schedule();
      else if (card) leaveSoon();
    }, { capture: true, passive: true });

    ctx.addEventListener(document, 'pointermove', (event) => {
      if (!event.isTrusted) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (event.shiftKey && !shiftDown) {
        shiftDown = true;
        schedule();
      }
    }, { capture: true, passive: true });

    ctx.addEventListener(window, 'blur', () => {
      shiftDown = false;
      dismiss();
    });
    ctx.addEventListener(window, 'scroll', () => card && dismiss(), { capture: true, passive: true });
    ctx.addEventListener(document, 'pointerdown', (event) => {
      if (card && !card.contains(event)) dismiss();
    }, { capture: true });
    ctx.onInvalidated(dismiss);
  },
});

class Card {
  hovered = false;
  private host = document.createElement('helium-max-preview');
  private root: ShadowRoot;
  private box = document.createElement('div');

  constructor(
    private url: string,
    label: string,
    private onClose: () => void,
    onHover: (inside: boolean) => void,
  ) {
    // Closed so the page can't read the summary; e2e builds keep it open for testing.
    this.root = this.host.attachShadow({ mode: import.meta.env.MODE === 'e2e' ? 'open' : 'closed' });
    const style = document.createElement('style');
    style.textContent = CARD_CSS;
    this.box.className = 'card';
    this.box.setAttribute('role', 'dialog');
    this.box.setAttribute('aria-label', 'Link preview');
    this.box.addEventListener('pointerenter', () => {
      this.hovered = true;
      onHover(true);
    });
    this.box.addEventListener('pointerleave', () => {
      this.hovered = false;
      onHover(false);
    });
    this.root.append(style, this.box);
    this.host.style.cssText = 'all: initial; position: fixed; inset: 0 auto auto 0; z-index: 2147483647;';
    document.documentElement.append(this.host);
    this.fill(label, null, 'Reading the page…', 'loading');
  }

  private anchor = { x: 0, y: 0 };

  /** Remember the pointer and position the card next to it. Re-run whenever the content changes size. */
  place(x: number, y: number) {
    this.anchor = { x, y };
    this.reposition();
  }

  private reposition() {
    const { x, y } = this.anchor;
    const width = 340;
    this.box.style.left = `${Math.min(Math.max(8, x + 14), window.innerWidth - width - 8)}px`;
    const height = this.box.offsetHeight;
    // Below the pointer when it fits, otherwise above it; never over the hovered line.
    const below = y + 20;
    const above = y - height - 16;
    this.box.style.top = `${below + height <= window.innerHeight - 8 || above < 8 ? below : above}px`;
  }

  render(preview: LinkPreview) {
    if (preview.summary) this.fill(preview.title || preview.domain, preview.domain, preview.summary, 'summary');
    else this.fill(preview.title || preview.domain, preview.domain, `Preview unavailable: ${preview.unavailable ?? 'unknown reason'}.`, 'muted');
  }

  /** `src` is a data URL fetched by the worker, so the page never requests the image itself. */
  setImage(src: string) {
    const img = Object.assign(document.createElement('img'), { className: 'image', src, alt: '', decoding: 'async' });
    img.addEventListener('load', () => this.reposition(), { once: true });
    img.addEventListener('error', () => img.remove(), { once: true });
    this.box.prepend(img);
  }

  renderError(message: string) {
    this.fill(domainOf(this.url), domainOf(this.url), message, 'muted');
  }

  contains(event: Event) {
    return event.composedPath().includes(this.host);
  }

  remove() {
    this.host.remove();
  }

  private fill(title: string, domain: string | null, body: string, tone: 'loading' | 'summary' | 'muted') {
    const domainEl = Object.assign(document.createElement('div'), { className: 'domain', textContent: domain ?? domainOf(this.url) });
    const titleEl = Object.assign(document.createElement('div'), { className: 'title', textContent: title });
    const bodyEl = Object.assign(document.createElement('p'), { className: `body ${tone}`, textContent: body });
    const open = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Open link' });
    open.addEventListener('click', () => {
      window.open(this.url, '_blank', 'noopener');
      this.onClose();
    });
    const actions = Object.assign(document.createElement('div'), { className: 'actions' });
    actions.append(open);
    if (tone === 'loading') bodyEl.setAttribute('aria-busy', 'true');
    this.box.replaceChildren(domainEl, titleEl, bodyEl, actions);
    this.reposition();
  }
}
