// Regenerates the README images: `pnpm screenshots`. Uses a scripted mock provider, so no key is needed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { chromium, expect, test, type Page, type Worker } from '@playwright/test';

declare const chrome: typeof browser;
const EXT = path.resolve(import.meta.dirname, '../../.output/chrome-mv3-e2e');
const OUT = path.resolve(import.meta.dirname, '../../docs/images');

const PAGES: Record<string, string> = {
  'php-unserialize': 'unserialize – PHP Manual',
  'cve-2024-4577': 'CVE-2024-4577 – PHP-CGI argument injection | NVD',
  'php-8-4-release': 'PHP 8.4 Release Announcement',
  'flights-mad': 'Flights from Mexico City to Madrid – Google Flights',
  'hotels-madrid': 'Hotels in Madrid, Spain – Booking.com',
  'prado': 'Museo del Prado – Plan your visit',
  'react-use': 'use – React',
  'react-compiler': 'React Compiler – React',
  'lofi': 'lofi hip hop radio – beats to relax/study to',
};

const ARTICLE = `<!doctype html><html lang="en"><head><title>CVE-2024-4577 – PHP-CGI argument injection | NVD</title>
<style>:root{color-scheme:light dark}body{font:17px/1.6 Georgia,serif;color:#222;background:#fbfaf7;margin:0}@media (prefers-color-scheme:dark){body{color:#ddd;background:#1b1b1f}header{border-color:#333!important;color:#999!important}}
header{font:14px system-ui;padding:14px 40px;border-bottom:1px solid #e4e1da;color:#555}
main{max-width:720px;margin:40px auto;padding:0 24px}h1{font:700 34px/1.2 system-ui;margin:0 0 8px}
.meta{font:14px system-ui;color:#777;margin-bottom:28px}h2{font:600 22px system-ui;margin-top:32px}
code{background:#eee;padding:1px 5px;border-radius:4px;font-size:15px}</style></head><body>
<header>NVD · Vulnerabilities · CVE-2024-4577</header><main><article>
<h1>CVE-2024-4577: PHP-CGI argument injection on Windows</h1>
<div class="meta">Published June 9, 2024 · CVSS 9.8 Critical</div>
<p>In PHP versions 8.1.* before 8.1.29, 8.2.* before 8.2.20 and 8.3.* before 8.3.8, when using Apache and PHP-CGI on Windows, if the system is set up to use certain code pages, Windows may use "Best-Fit" behavior to replace characters in the command line given to Win32 API functions.</p>
<p>The PHP CGI module may misinterpret those characters as PHP options, which may allow a malicious user to pass options to the PHP binary being run, and thus reveal the source code of scripts, run arbitrary PHP code on the server, and more.</p>
<h2>Affected configurations</h2><p>Windows installations running PHP in CGI mode, including the default XAMPP setup, with Chinese or Japanese locales confirmed exploitable. Other locales may be affected.</p>
<h2>Remediation</h2><p>Upgrade to PHP 8.1.29, 8.2.20 or 8.3.8. If you cannot upgrade, apply the mod_rewrite rules published by the PHP project, or move away from PHP-CGI to PHP-FPM.</p>
<p>See also the <a id="related" href="/page/php-8-4-release">PHP 8.4 release announcement</a> for currently supported versions.</p>
</article></main></body></html>`;

const BODIES: Record<string, string> = {
  'php-unserialize': 'unserialize() takes a single serialized variable and converts it back into a PHP value. Do not pass untrusted user input to unserialize() regardless of the options value of allowed_classes. Unserialization can result in code being loaded and executed due to object instantiation and autoloading, and a malicious user may be able to exploit this. Use a safe, standard data interchange format such as JSON (via json_decode() and json_encode()) if you need to pass serialized data to the user.',
  'php-8-4-release': 'PHP 8.4 is a major update of the PHP language. It contains many new features, such as property hooks, asymmetric visibility, an updated DOM API, performance improvements, bug fixes, and general cleanup. Supported versions: PHP 8.2 receives security fixes until December 2026, PHP 8.3 until December 2027 and PHP 8.4 until December 2028. Upgrading from 8.2 or 8.3 is covered in the migration guide.',
};

const otherPage = (slug: string, title: string) => {
  const body = BODIES[slug] ?? `More details about ${title}. `.repeat(8);
  const image = slug === 'php-8-4-release' ? '<meta property="og:image" content="/img/php-84-cover.png">' : '';
  return `<!doctype html><html><head><title>${title}</title>${image}</head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
};

const SEARCH_RESULTS = {
  results: [
    { title: 'Downloads – PHP', url: 'https://www.php.net/downloads.php', content: 'Current stable PHP 8.4 and 8.3 releases, with checksums and changelogs.' },
    { title: 'PHP 8.4 Release Announcement', url: 'https://www.php.net/releases/8.4/en.php', content: 'Property hooks, asymmetric visibility, new DOM API and more.' },
    { title: 'How to install PHP 8.4 on Ubuntu – a tutorial', url: 'https://example-tutorials.dev/php-8-4-ubuntu', content: 'Step by step guide using a third-party PPA.' },
    { title: 'windows.php.net – Downloads', url: 'https://windows.php.net/download/', content: 'Windows builds of PHP, VS17 x64 thread safe and non thread safe.' },
  ],
};

function reply(user: string, messages: { role: string; content: string }[], system: string): string {
  if (system.startsWith('You make a glanceable preview card')) {
    return JSON.stringify({
      blocked: false,
      headline: 'Property hooks and a new DOM API',
      facts: [
        { label: 'Released', info: 'November 2024, supported until December 2028' },
        { label: 'Highlights', info: 'Property hooks, asymmetric visibility, HTML5 DOM parser' },
        { label: 'PHP 8.2', info: 'Security fixes only until December 2026' },
      ],
    });
  }
  if (system.startsWith('You answer from several browser tabs')) {
    return "Yes, a PHP 8.2 server is affected if it runs PHP-CGI on Windows and is older than 8.2.20 [2].\n- The bug lets an attacker pass options to the PHP binary and run arbitrary code; it is rated CVSS 9.8 [2].\n- 8.2 only gets security fixes until December 2026, so moving to 8.3 or 8.4 buys more time [3].\n- Separately, never pass untrusted input to unserialize(); use JSON instead [1].\n\nThe tabs don't say whether Linux PHP-FPM setups are affected.";
  }
  if (system.startsWith('You pick which search result')) return JSON.stringify({ best: 1, why: 'Official php.net downloads page for the current release' });
  if (user.includes('<tabs>')) {
    const refs = (re: RegExp) => user.split('\n').filter((l) => re.test(l)).map((l) => Number(/^\[(\d+)\]/.exec(l)![1]));
    return JSON.stringify({ groups: [
      { name: 'PHP docs & CVEs', color: 'blue', tabs: refs(/PHP|php|CVE/) },
      { name: 'Madrid trip', color: 'orange', tabs: refs(/Madrid|Prado|Flights/) },
      { name: 'React', color: 'cyan', tabs: refs(/React/) },
    ] });
  }
  if (messages.length > 2) {
    return 'Upgrade PHP. The page says the fix is in 8.1.29, 8.2.20 and 8.3.8 (section "Remediation").\n\nIf you can\'t upgrade right away, it suggests the mod_rewrite rules from the PHP project or switching from PHP-CGI to PHP-FPM.';
  }
  return 'A critical (CVSS 9.8) argument-injection bug in PHP-CGI on Windows.\n- Windows "Best-Fit" character conversion lets an attacker smuggle PHP options into the CGI command line.\n- That can leak script source or run arbitrary PHP on the server.\n- Affects 8.1 before 8.1.29, 8.2 before 8.2.20 and 8.3 before 8.3.8; default XAMPP setups are exposed.\n- Fix: upgrade, or use the published mod_rewrite rules, or move to PHP-FPM.\n\nCaveat: exploitation is confirmed for Chinese and Japanese locales; the page says others "may be affected".';
}

test('readme screenshots', async () => {
  const server = http.createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method === 'OPTIONS') return void res.writeHead(204, cors).end();
    const slug = (req.url ?? '').replace(/^\/page\//, '');
    if (req.method === 'GET' && PAGES[slug]) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(slug === 'cve-2024-4577' ? ARTICLE : otherPage(slug, PAGES[slug]!));
    }
    if (req.method === 'GET' && req.url === '/img/php-84-cover.png') {
      res.writeHead(200, { 'content-type': 'image/png' });
      return void res.end(fs.readFileSync(path.resolve(import.meta.dirname, 'php-84-cover.png')));
    }
    if (req.method === 'GET' && req.url?.startsWith('/searx/search')) {
      res.writeHead(200, { 'content-type': 'application/json', ...cors });
      return void res.end(JSON.stringify(SEARCH_RESULTS));
    }
    if (req.method !== 'POST') return void res.writeHead(404).end();
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw);
      const user = body.messages.filter((m: { role: string }) => m.role === 'user').at(-1).content;
      res.writeHead(200, { 'content-type': 'application/json', ...cors });
      const system = body.messages.find((m: { role: string }) => m.role === 'system')?.content ?? '';
      res.end(JSON.stringify({ choices: [{ message: { content: reply(user, body.messages, system) } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  for (const scheme of ['light', 'dark'] as const) {
    const ctx = await chromium.launchPersistentContext('', {
      channel: 'chromium', colorScheme: scheme, viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    });
    const sw: Worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    // Real presets pointed at the mock, so the palette shows the same disclosures a user would see.
    await sw.evaluate(async (baseUrl) => {
      await chrome.storage.local.set({ settings: {
        activeProfileId: 'opencode-go',
        linkPreviews: true,
        search: { provider: 'searxng', baseUrl: baseUrl.replace(/\/v1$/, '/searx') },
        profiles: [
          { id: 'opencode-go', preset: 'opencode-go', name: 'OpenCode Go', model: 'deepseek-v4.1-flash', baseUrl },
          { id: 'deepseek', preset: 'deepseek', name: 'DeepSeek', model: 'deepseek-flash', baseUrl: '' },
          { id: 'mistral', preset: 'mistral', name: 'Mistral – DeepSeek', model: 'deepseek-v4-1-flash-1017', baseUrl },
          { id: 'anthropic', preset: 'anthropic', name: 'Anthropic', model: '', baseUrl: '' },
        ] } });
      await chrome.storage.session.set({ 'secret:opencode-go': 'demo', 'secret:mistral': 'demo', 'secret:deepseek': 'demo' });
    }, `${origin}/v1`);
    const blank = ctx.pages();
    let article: Page | undefined;
    for (const slug of Object.keys(PAGES)) {
      const p = await ctx.newPage();
      await p.goto(`${origin}/page/${slug}`);
      if (slug === 'cve-2024-4577') article = p;
    }
    for (const p of blank) await p.close();
    const page = article!;
    await page.bringToFront();
    const open = async () => {
      await sw.evaluate(async (url) => {
        const [t] = await chrome.tabs.query({ url });
        try { await chrome.tabs.sendMessage(t!.id!, { type: 'palette/toggle' }); }
        catch { await chrome.scripting.executeScript({ target: { tabId: t!.id! }, files: ['/content-scripts/overlay.js'] });
          await chrome.tabs.sendMessage(t!.id!, { type: 'palette/toggle' }); }
      }, page.url());
      const input = page.getByRole('combobox', { name: 'Search commands and tabs' });
      await expect(input).toBeFocused();
      return input;
    };
    const clip = { x: 200, y: 70, width: 800, height: 580 };

    const input = await open();
    await page.waitForTimeout(300);
    if (scheme === 'dark') await page.screenshot({ path: `${OUT}/palette-dark.png`, clip });
    else await page.screenshot({ path: `${OUT}/palette.png`, clip });

    if (scheme === 'light') {
      await input.fill('summarize page');
      await input.press('Enter');
      const followUp = page.getByRole('textbox', { name: 'Question about this page' });
      await expect(page.getByText(/critical \(CVSS 9.8\)/)).toBeVisible();
      await followUp.fill('How do I fix it?');
      await followUp.press('Enter');
      await expect(page.getByText(/Upgrade PHP/)).toBeVisible();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/ask-page.png`, clip });
      // Esc goes back from the conversation to the list, a second Esc closes the palette.
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');

      const again = await open();
      await again.fill('profile');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/profiles-palette.png`, clip });
      await again.fill('tidy');
      await again.press('Enter');
      await expect(page.getByText('Tabs tidied')).toBeVisible();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/tidy-tabs.png`, clip });

      const opts = await ctx.newPage();
      await opts.setViewportSize({ width: 900, height: 1000 });
      await opts.goto(sw.url().replace('background.js', 'options.html'));
      await opts.getByRole('listbox', { name: 'Profiles' }).getByRole('option', { name: /OpenCode Go/ }).click();
      await opts.waitForTimeout(300);
      await opts.screenshot({ path: `${OUT}/settings.png`, clip: { x: 120, y: 20, width: 660, height: 900 } });
      await opts.close();

      // Ask across the three PHP tabs.
      await page.bringToFront();
      // The Tidy Tabs result is still showing: Esc back to the list, Esc again to close.
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      const cross = await open();
      await cross.fill('ask across');
      await cross.press('Enter');
      await page.getByRole('button', { name: 'None' }).click();
      for (const name of [/unserialize/, /CVE-2024-4577/, /PHP 8.4 Release/]) await page.getByRole('checkbox', { name }).check();
      await page.getByRole('textbox', { name: 'Question for the selected tabs' }).fill('Is my PHP 8.2 server affected, and what should I upgrade to?');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/cross-select.png`, clip });
      await page.getByRole('textbox', { name: 'Question for the selected tabs' }).press('Enter');
      await expect(page.getByText(/buys more time/)).toBeVisible();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/cross-answer.png`, clip });
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');

      // Instant Links from real (mock SearXNG) results.
      const instant = await open();
      await instant.fill('download latest php');
      await instant.press('Enter');
      await expect(page.getByText('Best match')).toBeVisible();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/instant-links.png`, clip });
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');

      // Shift-hover preview on a link in the article (reload so the hover script is present).
      await page.reload();
      await page.locator('#related').scrollIntoViewIfNeeded();
      await page.hover('#related');
      await page.keyboard.down('Shift');
      await expect(page.locator('helium-max-preview .card')).toContainText('Property hooks');
      await expect(page.locator('helium-max-preview .card img.image')).toBeVisible();
      const link = (await page.locator('#related').boundingBox())!;
      const card = (await page.locator('helium-max-preview .card').boundingBox())!;
      const top = Math.max(0, Math.min(link.y, card.y) - 40);
      const bottom = Math.max(link.y + link.height, card.y + card.height) + 30;
      await page.screenshot({ path: `${OUT}/link-preview.png`, clip: { x: 60, y: top, width: 960, height: bottom - top } });
      await page.keyboard.up('Shift');
    }
    await ctx.close();
  }
  server.close(); server.closeAllConnections();
});
