import { describe, expect, it } from 'vitest';
import { scoreCandidate } from './pick';

const view = { width: 1280, height: 800 };
const block = (width: number, height: number, tag = 'DIV', display = 'block') => scoreCandidate({ width, height, tag, display }, view);

describe('scoreCandidate', () => {
  it('skips small pieces, inline text and anything as big as the view', () => {
    expect(block(300, 40)).toBeLessThan(0);
    expect(block(300, 200, 'SPAN', 'inline')).toBeLessThan(0);
    expect(block(1280, 300)).toBeLessThan(0);
    expect(block(1100, 700)).toBeLessThan(0);
  });

  it('prefers the bigger block, and an image over a same-sized block', () => {
    expect(block(600, 400)).toBeGreaterThan(block(300, 200));
    expect(block(300, 200, 'IMG', 'inline-block')).toBeGreaterThan(block(600, 400));
    expect(block(300, 200)).toBeGreaterThanOrEqual(0);
  });
});
