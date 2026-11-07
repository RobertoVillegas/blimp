import { describe, expect, it } from 'vitest';
import { HALF_LIFE_MS, byUsage, decayed, emptyRank, pickScore, promotePicks, record } from './score';

const now = Date.UTC(2026, 10, 8);

describe('palette ranking', () => {
  it('decays usage with a one-week half-life', () => {
    expect(decayed({ score: 4, at: now - HALF_LIFE_MS }, now)).toBeCloseTo(2);
    expect(decayed(undefined, now)).toBe(0);
  });

  it('puts used commands first, recent use beating old heavy use', () => {
    let data = emptyRank();
    for (let i = 0; i < 6; i++) data = record(data, { key: 'cmd:old', command: 'old' }, now - 5 * HALF_LIFE_MS);
    data = record(data, { key: 'cmd:new', command: 'new' }, now);
    const commands = [{ id: 'a' }, { id: 'old' }, { id: 'b' }, { id: 'new' }];
    expect(byUsage(commands, data, now).map((c) => c.id)).toEqual(['new', 'old', 'a', 'b']);
  });

  it('remembers what was picked for a query, including its prefixes', () => {
    let data = emptyRank();
    data = record(data, { key: 'tab:https://mail.google.com/', query: 'gmail' }, now);
    data = record(data, { key: 'tab:https://mail.google.com/', query: 'GM' }, now);
    expect(pickScore(data, 'gm', 'tab:https://mail.google.com/', now)).toBeCloseTo(1.5);
    expect(pickScore(data, 'g', 'tab:https://mail.google.com/', now)).toBeCloseTo(1);
    expect(pickScore(data, 'gma', 'other', now)).toBe(0);

    const items = ['cmd:tidy', 'tab:https://news.example/', 'tab:https://mail.google.com/', 'instant'];
    expect(promotePicks(items, (key) => (key === 'instant' ? null : key), data, 'gm', now)).toEqual([
      'tab:https://mail.google.com/',
      'cmd:tidy',
      'tab:https://news.example/',
      'instant',
    ]);
  });

  it('keeps the store bounded', () => {
    let data = emptyRank();
    for (let i = 0; i < 400; i++) data = record(data, { key: `k${i % 9}`, query: `q${i}` }, now + i);
    expect(Object.keys(data.picks).length).toBe(300);
    for (let i = 0; i < 9; i++) data = record(data, { key: `k${i}`, query: 'same' }, now + 1000 + i);
    expect(Object.keys(data.picks.same!).length).toBe(5);
  });
});
