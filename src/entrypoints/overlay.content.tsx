import ReactDOM from 'react-dom/client';
import type { ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { PaletteIntent, PaletteSignal } from '@/shared/messages';
import { Palette } from '@/ui/palette/Palette';
import { showInTopLayer } from '@/ui/top-layer';
import { startCapture } from '@/ui/capture';
import paletteCss from '@/ui/palette/palette.css?inline';

// Injected on demand by the background (activeTab grant), never on every page.
export default defineContentScript({
  registration: 'runtime',
  matches: ['<all_urls>'],
  // CSS is inlined into the shadow root, so no extension file is exposed to webpages.
  cssInjectionMode: 'manual',

  main(ctx) {
    let ui: ShadowRootContentScriptUi<ReactDOM.Root> | undefined;
    let opening = false;
    let previousFocus: Element | null = null;

    const close = () => {
      ui?.remove();
      ui = undefined;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };

    const open = async (intent?: PaletteIntent) => {
      if (opening) return;
      opening = true;
      previousFocus = document.activeElement;
      // Read before the palette takes focus, which clears the page's selection.
      const selection = window.getSelection()?.toString().trim().slice(0, 5_000) ?? '';
      const page = { title: document.title, url: location.href };
      try {
        ui = await createShadowRootUi(ctx, {
          name: 'helium-max-palette',
          position: 'modal',
          zIndex: 2147483647,
          isolateEvents: true,
          css: paletteCss,
          onMount(container) {
            const root = ReactDOM.createRoot(container);
            root.render(
              <div
                className="hm-root hm-backdrop"
                onMouseDown={(event) => event.target === event.currentTarget && close()}
              >
                <Palette
                  intent={intent}
                  onClose={close}
                  page={page}
                  selection={selection}
                  onCapture={() => setTimeout(() => startCapture(document.title), 0)}
                />
              </div>,
            );
            return root;
          },
          onRemove(root) {
            root?.unmount();
          },
        });
        ui.mount();
        showInTopLayer(ui.shadowHost, 'fullscreen');
      } finally {
        opening = false;
      }
    };

    browser.runtime.onMessage.addListener((message: PaletteSignal) => {
      if (message?.type !== 'palette/toggle') return;
      if (ui && !message.intent) close();
      else {
        if (ui) close();
        void open(message.intent);
      }
    });

    // Best effort: once injected, ⌘K/Ctrl+K on this page also toggles the palette.
    ctx.addEventListener(
      window,
      'keydown',
      (event) => {
        // Esc closes the palette even when focus has drifted back to the page.
        if (event.key === 'Escape' && ui && !event.composedPath().includes(ui.shadowHost)) {
          event.preventDefault();
          close();
          return;
        }
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          event.stopPropagation();
          if (ui) close();
          else void open();
        }
      },
      { capture: true },
    );
    ctx.onInvalidated(close);
  },
});
