/**
 * Runs inside the page (scripting.executeScript, isolated world), so it must be self-contained.
 * Shows `desired` as the tab title and keeps it there when the site changes its title, carrying
 * over a leading unread count like Gmail's "(3)". `null` restores the site's own title and stops.
 */
export function keepTitle(desired: string | null): void {
  type Keeper = { desired: string | null; original: string; observer?: MutationObserver; applying: boolean };
  const scope = globalThis as unknown as { __heliumMaxTitle?: Keeper };
  const keeper: Keeper = scope.__heliumMaxTitle ?? { desired: null, original: document.title, applying: false };
  scope.__heliumMaxTitle = keeper;

  const render = () => {
    if (keeper.desired === null) return keeper.original;
    const count = /\((\d+\+?)\)/.exec(keeper.original)?.[1];
    return count ? `(${count}) ${keeper.desired}` : keeper.desired;
  };
  const apply = () => {
    const next = render();
    if (document.title === next) return;
    keeper.applying = true;
    document.title = next;
    keeper.applying = false;
  };

  keeper.desired = desired;
  if (desired === null) {
    keeper.observer?.disconnect();
    keeper.observer = undefined;
    apply();
    delete scope.__heliumMaxTitle;
    return;
  }
  if (!keeper.observer) {
    keeper.observer = new MutationObserver(() => {
      if (keeper.applying) return;
      // The site changed its title: remember it as the original, then put ours back.
      if (document.title !== render()) {
        keeper.original = document.title;
        apply();
      }
    });
    keeper.observer.observe(document.head ?? document.documentElement, { subtree: true, childList: true, characterData: true });
  }
  apply();
}
