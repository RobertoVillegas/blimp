import type { Page } from '@playwright/test';
import { CAPTURE_EXTENSION, configureMockProvider, expect, openPalette, test } from './helpers';

// Capture needs activeTab, which only a real shortcut or click grants; this build has <all_urls> instead.
test.use({ extensionPath: CAPTURE_EXTENSION });

/** Size of the clipboard image and the color at its center. */
const clipboardImage = (page: Page) =>
  page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bitmap = await createImageBitmap(await item!.getType('image/png'));
    const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const [r, g, b] = ctx.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data;
    return { width: bitmap.width, height: bitmap.height, center: [r, g, b], dpr: devicePixelRatio };
  });

test('Capture: drag over an area, get exactly that area on the clipboard, with Save', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.origin });
  const page = await context.newPage();
  await page.goto(`${server.origin}/capture`);

  const input = await openPalette(sw, page);
  await input.fill('capture');
  await input.press('Enter');
  await expect(page.locator('blimp-capture')).toHaveCount(1);

  // Select the red block (100,100 → 300,200).
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(200, 150, { steps: 3 });
  await page.mouse.move(300, 200, { steps: 3 });
  await page.mouse.up();

  const result = page.locator('blimp-capture [role="status"]');
  await expect(result).toContainText('Copied to the clipboard.');
  await expect(result.getByRole('link', { name: 'Save' })).toHaveAttribute('download', /^Capture page .*\.png$/);
  const image = await clipboardImage(page);
  expect(image.width).toBe(200 * image.dpr);
  expect(image.height).toBe(100 * image.dpr);
  expect(image.center).toEqual([255, 0, 0]);
});

test('Capture: Enter takes the whole view; Esc cancels', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.origin });
  const page = await context.newPage();
  await page.goto(`${server.origin}/capture`);

  let input = await openPalette(sw, page);
  await input.fill('capture');
  await input.press('Enter');
  await expect(page.locator('blimp-capture')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('blimp-capture')).toHaveCount(0);

  input = await openPalette(sw, page);
  await input.fill('capture');
  await input.press('Enter');
  await expect(page.locator('blimp-capture')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.locator('blimp-capture [role="status"]')).toContainText('Copied');
  const image = await clipboardImage(page);
  const view = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(image.width).toBe(view.width * image.dpr);
  expect(image.height).toBe(view.height * image.dpr);
  // No selection layer or palette in the picture: the center is the white page.
  expect(image.center).toEqual([255, 255, 255]);
});
