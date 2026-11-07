import { defineConfig } from 'wxt';

// Hosted provider origins are optional and requested at the point of use
// (Settings → Save/Test), so a fresh install asks for no site access.
const PROVIDER_ORIGINS = [
  'https://api.openai.com/*',
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
  'https://openrouter.ai/*',
  'https://api.deepseek.com/*',
  'https://api.mistral.ai/*',
  'https://opencode.ai/*',
  'https://api.search.brave.com/*',
];

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Blimp',
    description:
      "Arc's best features for Helium: ⌘K palette, Tidy Tabs, page Q&A, link previews, peeks and more. Bring your own AI key.",
    minimum_chrome_version: '120',
    permissions: ['activeTab', 'alarms', 'contextMenus', 'scripting', 'search', 'storage', 'tabs', 'tabGroups'],
    optional_permissions: ['downloads', 'history'],
    optional_host_permissions: [
      ...PROVIDER_ORIGINS,
      'http://localhost/*',
      'http://127.0.0.1/*',
      'https://*/*',
      'http://*/*',
    ],
    action: { default_title: 'Blimp (⌘K)' },
    commands: {
      'open-palette': {
        suggested_key: { default: 'Ctrl+K', mac: 'Command+K' },
        description: 'Open the Blimp command palette',
      },
      'open-palette-fallback': {
        suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' },
        description: 'Open the command palette (fallback shortcut)',
      },
      // Chromium opens the side panel only straight from a user action like this shortcut.
      'open-sidebar': {
        suggested_key: { default: 'Ctrl+Shift+S', mac: 'Command+Shift+S' },
        description: 'Open the Blimp sidebar',
      },
      'little-blimp': {
        suggested_key: { default: 'Alt+Shift+N', mac: 'Alt+Shift+N' },
        description: 'Open a Little Blimp window',
      },
      'little-to-main': {
        description: 'Move the Little Blimp page into the main window',
      },
      'tidy-tabs': {
        description: 'Tidy Tabs: group ungrouped tabs in this window',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },
  hooks: {
    // The overlay is injected on demand through activeTab. WXT would otherwise turn the
    // runtime content script's `matches` into install-time access to every site.
    'build:manifestGenerated': (wxt, manifest) => {
      const e2e = wxt.config.mode.startsWith('e2e');
      // e2e builds reach the local fixture server without a prompt. The e2e-capture build also
      // stands in for activeTab, which only a real shortcut or toolbar click grants.
      manifest.host_permissions = wxt.config.mode === 'e2e-capture' ? ['<all_urls>'] : e2e ? ['http://127.0.0.1/*'] : [];
      // e2e can't click permission prompts, so Tidy Downloads' optional permission is granted up front.
      if (e2e) manifest.permissions = [...(manifest.permissions ?? []), 'downloads', 'history'];
    },
  },
});
