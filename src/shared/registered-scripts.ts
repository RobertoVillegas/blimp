/**
 * Keep an opt-in content script registered exactly while its setting is on. Chrome injects it only
 * on sites the user granted access to, so turning the setting on is what asks for access.
 */
export async function syncRegisteredScript(id: string, file: string, enabled: boolean): Promise<void> {
  const registered = await browser.scripting.getRegisteredContentScripts({ ids: [id] });
  if (enabled && registered.length === 0) {
    await browser.scripting.registerContentScripts([
      { id, matches: ['http://*/*', 'https://*/*'], js: [file], runAt: 'document_idle', allFrames: false, persistAcrossSessions: true },
    ]);
  } else if (!enabled && registered.length > 0) {
    await browser.scripting.unregisterContentScripts({ ids: [id] });
  }
}
