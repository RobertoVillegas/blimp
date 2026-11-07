// Builds the Chrome Web Store images in store/ from the README screenshots: pnpm store:images
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(import.meta.dirname, '..');
const img = (f) => 'data:image/png;base64,' + fs.readFileSync(`${root}/docs/images/${f}`).toString('base64');
const shots = [
  ['palette.png', 'One ⌘K bar for everything', 'Commands, your tabs, and what you use most, a keystroke away.'],
  ['ask-page.png', 'Ask the page you are reading', 'Answers quote the page, and every quote is checked against it.'],
  ['tidy-tabs.png', 'Tidy Tabs, on request', 'Your AI groups and names tabs. Undo puts everything back.'],
  ['link-preview.png', 'Hold Shift to preview a link', 'A short headline and the key facts, without opening a tab.'],
  ['cross-answer.png', 'Ask across your tabs', 'One answer from the tabs you pick, with numbered sources.'],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
for (const [i, [file, title, sub]] of shots.entries()) {
  await page.setContent(`<html><body style="margin:0;width:1280px;height:800px;background:linear-gradient(160deg,#2b2d42,#16171f);font-family:-apple-system,system-ui,sans-serif;color:#fff;display:flex;flex-direction:column;align-items:center;overflow:hidden">
  <h1 style="margin:52px 0 6px;font-size:44px;font-weight:700;letter-spacing:-.5px">${title}</h1>
  <p style="margin:0 0 34px;font-size:22px;opacity:.75">${sub}</p>
  <img src="${img(file)}" style="max-width:1080px;max-height:560px;border-radius:14px;box-shadow:0 24px 60px rgb(0 0 0/.45)"></body></html>`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${root}/store/screenshot-${i + 1}.png` });
}
const svg = fs.readFileSync(`${root}/assets/icon.svg`, 'utf8');
await page.setViewportSize({ width: 440, height: 280 });
await page.setContent(`<html><body style="margin:0;width:440px;height:280px;background:linear-gradient(160deg,#2b2d42,#16171f);display:flex;align-items:center;gap:22px;padding:0 34px;box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif;color:#fff">
<div style="width:110px;height:110px;flex:none">${svg.replace('<svg ', '<svg width="110" height="110" ')}</div>
<div><div style="font-size:42px;font-weight:700">Blimp</div><div style="font-size:17px;opacity:.8;margin-top:6px;line-height:1.35">A ⌘K command bar with AI,<br>tabs and media controls</div></div></body></html>`);
await page.screenshot({ path: `${root}/store/promo-small-440x280.png` });
await browser.close();
