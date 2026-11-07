import { describe, expect, it } from 'vitest';
import { addressFor } from '.';

describe('Little Blimp address box', () => {
  it('treats domains and URLs as addresses and everything else as a search', () => {
    expect(addressFor('react.dev')).toBe('https://react.dev');
    expect(addressFor('github.com/RobertoVillegas/blimp')).toBe('https://github.com/RobertoVillegas/blimp');
    expect(addressFor('http://localhost:3000')).toBe('http://localhost:3000');
    expect(addressFor('how tall is everest')).toBeNull();
    expect(addressFor('javascript:alert(1)')).toBeNull();
    expect(addressFor('weather')).toBeNull();
  });
});
