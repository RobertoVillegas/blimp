import { configureMockProvider, expect, openPages, openPalette, test } from './helpers';

test('Ask AI: type a question, press Tab, get an answer and ask a follow-up', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin);
  const [page] = await openPages(context, server.origin, ['news-a']);
  const input = await openPalette(sw, page!);
  await input.fill('what is a monad');
  await expect(page!.getByRole('option', { name: /Ask AI: “what is a monad”/ })).toBeVisible();
  await input.press('Tab');

  await expect(page!.getByText('QUICK ANSWER 1 to "what is a monad"')).toBeVisible();
  // It doesn't read the page.
  expect(server.requests[0]!.user).toBe('what is a monad');
  expect(JSON.stringify(server.requests[0]!.body)).not.toContain('Council approves');

  const followUp = page!.getByRole('textbox', { name: 'Follow-up question' });
  await followUp.fill('in one sentence');
  await followUp.press('Enter');
  await expect(page!.getByText('QUICK ANSWER 2 to "in one sentence"')).toBeVisible();
  const messages = server.requests[1]!.body.messages as { role: string }[];
  expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
});

test('Browse for Me searches, reads the top results and answers with clickable sources', async ({ context, sw, server }) => {
  await configureMockProvider(sw, server.origin, 'mock', { search: { provider: 'searxng', baseUrl: `${server.origin}/searx` } });
  const [page] = await openPages(context, server.origin, ['news-a']);
  const input = await openPalette(sw, page!);
  await input.fill('how do react hooks work');
  await page!.getByRole('option', { name: /Browse for Me: “how do react hooks work”/ }).click();

  await expect(page!.getByText('BROWSE ANSWER for "how do react hooks work".')).toBeVisible();
  const sources = page!.getByRole('list', { name: 'Sources' }).getByRole('listitem');
  await expect(sources).toHaveText([/React tutorial blog/, /Hooks reference – React/]);
  // The pages themselves were read, not just their snippets.
  expect(server.gets).toEqual(expect.arrayContaining(['/page/react-state', '/page/react-hooks']));
  const sent = server.requests.find((r) => r.system.startsWith("You answer someone's web search"))!.user;
  expect(sent).toContain('useState lets a component remember information');
  expect(sent).not.toContain('hunter2-PASSWORD');

  const opened = context.waitForEvent('page');
  await page!.getByRole('button', { name: 'Open source 2' }).click();
  expect((await opened).url()).toBe(`${server.origin}/page/react-hooks`);
});
