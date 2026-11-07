import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionOf, safeFilename } from './filename';
import { handleDeterminingFilename } from './suggest';

describe('safeFilename', () => {
  it('keeps the original extension whatever the model says', () => {
    expect(safeFilename('Invoice March 2026 - Acme', 'inv_8812.pdf')).toBe('Invoice March 2026 - Acme.pdf');
    expect(safeFilename('Invoice.pdf', 'inv.pdf')).toBe('Invoice.pdf');
    expect(safeFilename('Invoice.exe', 'inv.pdf')).toBe('Invoice.pdf');
    expect(safeFilename('Backup', 'site-backup.tar.gz')).toBe('Backup.tar.gz');
    expect(safeFilename('Notes', 'README')).toBe('Notes');
  });

  it('removes paths, traversal and unsafe characters', () => {
    expect(safeFilename('../../etc/passwd', 'x.txt')).toBe('passwd.txt');
    expect(safeFilename('a\\..\\b:c*?"<>|d', 'x.txt')).toBe('b c d.txt');
    expect(safeFilename('...hidden. ', 'x.txt')).toBe('hidden.txt');
    expect(safeFilename('report\u202egpj.exe', 'x.pdf')).toBe('report gpj.pdf');
  });

  it('avoids reserved names and empty results', () => {
    expect(safeFilename('CON', 'x.txt')).toBe('_CON.txt');
    expect(safeFilename(' ./ ', 'x.txt')).toBeNull();
  });

  it('caps the length', () => {
    expect(safeFilename('a'.repeat(300), 'x.csv')!.length).toBe(104);
  });

  it('detects extensions', () => {
    expect(extensionOf('a.tar.gz')).toBe('.tar.gz');
    expect(extensionOf('.bashrc')).toBe('');
    expect(extensionOf('photo.JPEG')).toBe('.JPEG');
  });
});

describe('handleDeterminingFilename', () => {
  const item = {
    filename: '/Users/me/Downloads/inv_8812.pdf',
    url: 'https://billing.acme.com/download?id=8812&token=secret',
    finalUrl: 'https://billing.acme.com/download?id=8812&token=secret',
    referrer: 'https://billing.acme.com/invoices?session=abc',
    mime: 'application/pdf',
  } as Browser.downloads.DownloadItem;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const deps = (propose: () => Promise<string | null>, enabled = true) => ({
    isEnabled: async () => enabled,
    pageTitleFor: async () => 'Invoices – Acme',
    propose: vi.fn(propose),
    timeoutMs: 4_000,
  });

  it('suggests the AI name once, without query strings in the context', async () => {
    const suggest = vi.fn();
    const d = deps(async () => 'Acme invoice 8812.pdf');
    expect(handleDeterminingFilename(item, suggest, d)).toBe(true);
    await vi.runAllTimersAsync();
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest).toHaveBeenCalledWith({ filename: 'Acme invoice 8812.pdf', conflictAction: 'uniquify' });
    const [context] = d.propose.mock.calls[0] as unknown as [Record<string, string>];
    expect(context).toMatchObject({ filename: 'inv_8812.pdf', source: 'billing.acme.com/download', referrer: 'billing.acme.com/invoices' });
    expect(JSON.stringify(context)).not.toContain('secret');
  });

  it('falls back to the original name after the timeout, and ignores a late answer', async () => {
    const suggest = vi.fn();
    let resolve!: (name: string) => void;
    handleDeterminingFilename(item, suggest, deps(() => new Promise((r) => (resolve = r))));
    await vi.advanceTimersByTimeAsync(4_000);
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest).toHaveBeenCalledWith();
    resolve('Late name.pdf');
    await vi.runAllTimersAsync();
    expect(suggest).toHaveBeenCalledTimes(1);
  });

  it('keeps the original name when disabled or on failure', async () => {
    for (const d of [deps(async () => 'x', false), deps(async () => Promise.reject(new Error('boom'))), deps(async () => null)]) {
      const suggest = vi.fn();
      handleDeterminingFilename(item, suggest, d);
      await vi.runAllTimersAsync();
      expect(suggest).toHaveBeenCalledTimes(1);
      expect(suggest).toHaveBeenCalledWith();
    }
  });
});
