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
];

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Helium Max',
    description:
      'Local-first, bring-your-own-key AI for Helium: command palette, Tidy Tabs, page Q&A and more.',
    minimum_chrome_version: '120',
    permissions: ['activeTab', 'scripting', 'storage', 'tabs', 'tabGroups'],
    optional_host_permissions: [
      ...PROVIDER_ORIGINS,
      'http://localhost/*',
      'http://127.0.0.1/*',
      'https://*/*',
      'http://*/*',
    ],
    action: { default_title: 'Helium Max (⌘K)' },
    commands: {
      'open-palette': {
        suggested_key: { default: 'Ctrl+K', mac: 'Command+K' },
        description: 'Open the Helium Max command palette',
      },
      'open-palette-fallback': {
        suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' },
        description: 'Open the command palette (fallback shortcut)',
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
    // The e2e build talks to a local fixture server without a permission prompt.
    // The overlay is injected on demand through activeTab. WXT would otherwise turn the
    // runtime content script's `matches` into install-time access to every site.
    'build:manifestGenerated': (wxt, manifest) => {
      manifest.host_permissions = wxt.config.mode === 'e2e' ? ['http://127.0.0.1/*'] : [];
    },
  },
});
