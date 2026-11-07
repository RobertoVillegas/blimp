import { describe, expect, it } from 'vitest';
import { actionLink, intentSchema } from './intents';

describe('Instant Links intents', () => {
  it('builds links from fixed templates, only inserting the text', () => {
    expect(actionLink({ type: 'site', site: 'YouTube', query: 'lofi beats' })).toEqual({
      label: 'YouTube: lofi beats',
      url: 'https://www.youtube.com/results?search_query=lofi%20beats',
    });
    const directions = new URL(actionLink({ type: 'directions', query: '', origin: 'Zócalo', destination: 'Coyoacán & co' })!.url);
    expect(directions.origin + directions.pathname).toBe('https://www.google.com/maps/dir/');
    expect(Object.fromEntries(directions.searchParams)).toEqual({ api: '1', destination: 'Coyoacán & co', origin: 'Zócalo' });
    expect(actionLink({ type: 'images', query: 'red pandas' })!.url).toBe('https://www.google.com/search?tbm=isch&q=red%20pandas');
  });

  it('never trusts a URL-looking query to change the destination host', () => {
    const link = actionLink({ type: 'maps', query: 'https://evil.example/?x=1' })!;
    expect(new URL(link.url).hostname).toBe('www.google.com');
  });

  it('ignores unknown sites and web actions', () => {
    expect(actionLink({ type: 'site', site: 'myspace', query: 'x' })).toBeNull();
    expect(actionLink({ type: 'web', query: 'x' })).toBeNull();
  });

  it('validates the model output shape', () => {
    expect(intentSchema.safeParse({ navigate: true, actions: [{ type: 'web', query: 'react docs' }] }).success).toBe(true);
    expect(intentSchema.safeParse({ actions: [{ type: 'teleport', query: 'x' }] }).success).toBe(false);
    expect(intentSchema.safeParse({ actions: [] }).success).toBe(false);
  });
});
