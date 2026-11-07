import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

test('Copy URL, Copy as Markdown Link and Copy as Quote put the right text on the clipboard', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.origin });
  const [page] = await openPages(context, server.origin, ['recipe-pasta']);
  const clipboard = () => page!.evaluate(() => navigator.clipboard.readText());
  const run = async (command: string) => {
    const input = await openPalette(sw, page!);
    await input.fill(command);
    await input.press('Enter');
    await expect(input).toBeHidden();
    await expect(page!.locator('helium-max-palette')).toHaveCount(0);
  };

  await run('copy url');
  expect(await clipboard()).toBe(`${server.origin}/page/recipe-pasta`);

  await run('copy as markdown');
  expect(await clipboard()).toBe(`[Easy pasta recipe](${server.origin}/page/recipe-pasta)`);

  // Select a sentence on the page, then open the palette: the selection is captured before focus moves.
  await page!.evaluate(() => {
    const paragraph = document.querySelector('article p')!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  await run('copy as quote');
  expect(await clipboard()).toBe(
    `> Boil pasta for nine minutes, then toss with garlic and olive oil.\n>\n> — [Easy pasta recipe](${server.origin}/page/recipe-pasta)`,
  );
});

test('Copy as Quote explains when nothing is selected', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['recipe-pasta']);
  const input = await openPalette(sw, page!);
  await input.fill('copy as quote');
  await input.press('Enter');
  await expect(page!.getByRole('alert')).toContainText('Select some text on the page first');
});
