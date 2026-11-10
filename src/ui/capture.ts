import { pickElementAt } from '@/features/capture/pick';
import { send } from '@/shared/send';
import { showInTopLayer } from './top-layer';

const CSS = `
:host { all: initial; }
.layer { position: fixed; inset: 0; cursor: crosshair; background: transparent; user-select: none; -webkit-user-select: none; outline: none; }
.hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); padding: 6px 12px; border-radius: 999px;
  background: rgb(20 20 22 / 0.85); color: #fff; font: 13px/1.4 -apple-system, system-ui, sans-serif; pointer-events: none; }
.box { position: fixed; border: 2px solid #4da3ff; border-radius: 3px; background: transparent; box-shadow: 0 0 0 9999px rgb(0 0 0 / 0.35); pointer-events: none; }
.box.element { transition: left 90ms ease-out, top 90ms ease-out, width 90ms ease-out, height 90ms ease-out; }
@media (prefers-reduced-motion: reduce) { .box.element { transition: none; } }
.done { position: fixed; right: 16px; bottom: 16px; width: 260px; padding: 10px; border-radius: 12px; display: grid; gap: 8px;
  background: #fff; color: #1d1d1f; box-shadow: 0 12px 36px rgb(0 0 0 / 0.25), 0 0 0 1px rgb(0 0 0 / 0.08);
  font: 13px/1.4 -apple-system, system-ui, sans-serif; }
.done img { width: 100%; max-height: 160px; object-fit: contain; border-radius: 6px; background: #f2f2f4; }
.row { display: flex; gap: 8px; align-items: center; }
.row span { flex: 1; }
a, button { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 6px; border: 1px solid rgb(0 0 0 / 0.12);
  background: transparent; color: #0066cc; cursor: pointer; text-decoration: none; }
@media (prefers-color-scheme: dark) {
  .done { background: #232326; color: #f2f2f4; box-shadow: 0 12px 36px rgb(0 0 0 / 0.5), 0 0 0 1px rgb(255 255 255 / 0.12); }
  .done img { background: #111; }
  a, button { color: #4da3ff; border-color: rgb(255 255 255 / 0.15); }
}`;

type Rect = { x: number; y: number; width: number; height: number };

/**
 * Arc's Capture: hover to highlight an element and click to take it, or drag to pick an area.
 * Enter takes everything visible, Esc cancels. The image is copied to the clipboard and can be saved.
 */
export function startCapture(pageTitle: string): void {
  const host = document.createElement('blimp-capture');
  const root = host.attachShadow({ mode: import.meta.env.MODE.startsWith('e2e') ? 'open' : 'closed' });
  const style = Object.assign(document.createElement('style'), { textContent: CSS });
  const layer = Object.assign(document.createElement('div'), { className: 'layer', tabIndex: -1 });
  const hint = Object.assign(document.createElement('div'), { className: 'hint', textContent: 'Click an element or drag an area · Enter for the whole view · Esc to cancel' });
  const box = Object.assign(document.createElement('div'), { className: 'box', hidden: true });
  root.append(style, layer, hint, box);
  host.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647;';
  document.documentElement.append(host);
  showInTopLayer(host, 'fullscreen');
  layer.focus();

  let start: { x: number; y: number } | null = null;
  let rect: Rect | null = null;
  // The element under the cursor, as Arc picks it; a click captures it.
  let hovered: Rect | null = null;
  let frame = 0;
  const showBox = (area: Rect, element: boolean) => {
    box.classList.toggle('element', element);
    Object.assign(box.style, { left: `${area.x}px`, top: `${area.y}px`, width: `${area.width}px`, height: `${area.height}px` });
    box.hidden = false;
  };
  const hover = (x: number, y: number) => {
    const element = pickElementAt(x, y, host);
    hovered = element ? visiblePart(element.getBoundingClientRect()) : null;
    if (hovered) showBox(hovered, true);
    else box.hidden = true;
  };
  const finish = () => {
    removeEventListener('keydown', onKey, true);
    host.remove();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      finish();
      void take(null, pageTitle);
    }
  };
  addEventListener('keydown', onKey, true);

  layer.addEventListener('pointerdown', (event) => {
    // Dragging picks an area; it must not select the page's text underneath.
    event.preventDefault();
    start = { x: event.clientX, y: event.clientY };
    layer.setPointerCapture(event.pointerId);
  });
  layer.addEventListener('pointermove', (event) => {
    if (!start) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => hover(event.clientX, event.clientY));
      return;
    }
    // Under 4px it's still a click on the highlighted element, not a drag.
    if (!rect && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) return;
    rect = {
      x: Math.min(start.x, event.clientX),
      y: Math.min(start.y, event.clientY),
      width: Math.abs(event.clientX - start.x),
      height: Math.abs(event.clientY - start.y),
    };
    showBox(rect, false);
    hint.hidden = true;
  });
  layer.addEventListener('pointerup', (event) => {
    const dragged = rect && rect.width >= 4 && rect.height >= 4 ? rect : null;
    if (!dragged && !rect) hover(event.clientX, event.clientY);
    const picked = dragged ?? (rect ? null : hovered);
    start = null;
    cancelAnimationFrame(frame);
    finish();
    // A click with nothing highlighted takes the whole view, like Enter.
    void take(picked, pageTitle);
  });
}

/** The part of an element that's on screen: only what's visible can be captured. */
function visiblePart(bounds: DOMRect): Rect | null {
  const x = Math.max(0, bounds.left);
  const y = Math.max(0, bounds.top);
  const width = Math.min(innerWidth, bounds.right) - x;
  const height = Math.min(innerHeight, bounds.bottom) - y;
  return width >= 4 && height >= 4 ? { x, y, width, height } : null;
}

async function take(rect: Rect | null, pageTitle: string): Promise<void> {
  // Let the selection layer disappear from the screen before the browser takes the picture.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  let blob: Blob;
  try {
    const dataUrl = await send({ type: 'capture/visible' });
    blob = await crop(dataUrl, rect);
  } catch (error) {
    showResult(null, pageTitle, error instanceof Error ? error.message : 'Capture failed.');
    return;
  }
  let copied = false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    copied = true;
  } catch {
    // Some sites block clipboard access; Save still works.
  }
  showResult(blob, pageTitle, copied ? 'Copied to the clipboard.' : "This site doesn't allow copying images; use Save.");
}

async function crop(dataUrl: string, rect: Rect | null): Promise<Blob> {
  const image = await createImageBitmap(await (await fetch(dataUrl)).blob());
  // The screenshot is in device pixels; the selection is in CSS pixels.
  const scale = image.width / innerWidth;
  const area = rect ?? { x: 0, y: 0, width: innerWidth, height: innerHeight };
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(area.width * scale),
    height: Math.round(area.height * scale),
  });
  canvas.getContext('2d')!.drawImage(image, area.x * scale, area.y * scale, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not make the image.'))), 'image/png'));
}

function showResult(blob: Blob | null, pageTitle: string, message: string): void {
  const host = document.createElement('blimp-capture');
  const root = host.attachShadow({ mode: import.meta.env.MODE.startsWith('e2e') ? 'open' : 'closed' });
  const card = Object.assign(document.createElement('div'), { className: 'done' });
  card.setAttribute('role', 'status');
  const url = blob ? URL.createObjectURL(blob) : '';
  if (blob) card.append(Object.assign(document.createElement('img'), { src: url, alt: 'Captured area' }));
  const row = Object.assign(document.createElement('div'), { className: 'row' });
  row.append(Object.assign(document.createElement('span'), { textContent: message }));
  if (blob) {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.');
    const name = `${pageTitle.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Capture'} ${stamp}.png`;
    row.append(Object.assign(document.createElement('a'), { href: url, download: name, textContent: 'Save' }));
  }
  const close = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Close' });
  const dismiss = () => {
    host.remove();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };
  close.addEventListener('click', dismiss);
  row.append(close);
  card.append(row);
  root.append(Object.assign(document.createElement('style'), { textContent: CSS }), card);
  host.style.cssText = 'position: fixed; inset: 0 auto auto 0; z-index: 2147483647;';
  document.documentElement.append(host);
  showInTopLayer(host, 'point');
  setTimeout(dismiss, 8_000);
}
