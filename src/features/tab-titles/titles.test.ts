import { describe, expect, it } from 'vitest';
import { titleKey } from '.';
import { cleanTabTitle } from './prompt';

describe('tab titles', () => {
  it('keys names by page, ignoring query and fragment', () => {
    expect(titleKey('https://mail.google.com/mail/u/0/#inbox')).toBe('https://mail.google.com/mail/u/0/');
    expect(titleKey('https://x.com/a?b=1')).toBe('https://x.com/a');
    expect(titleKey('chrome://settings')).toBeNull();
  });

  it('cleans model output', () => {
    expect(cleanTabTitle('  "React   Hooks" ')).toBe('React Hooks');
    expect(cleanTabTitle('a'.repeat(50))).toHaveLength(30);
    expect(cleanTabTitle('Mail‮')).toBe('Mail');
  });
});

describe('command ranking', () => {
  it('puts the command whose title matches the query first', async () => {
    const { COMMANDS, matches, titleRank } = await import('@/ui/palette/commands');
    const ranked = (query: string) =>
      COMMANDS.filter((c) => matches(query, c.title, c.keywords, c.description))
        .sort((a, b) => titleRank(query, a.title) - titleRank(query, b.title))
        .map((c) => c.id);
    expect(ranked('rename tab')[0]).toBe('rename-tab');
    expect(ranked('tidy')[0]).toBe('tidy');
    expect(ranked('summarize page')[0]).toBe('summarize-page');
  });
});
