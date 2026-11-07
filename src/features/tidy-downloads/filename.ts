const COMPOUND_EXTENSIONS = ['.tar.gz', '.tar.bz2', '.tar.xz', '.tar.zst'];
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
const MAX_BASE_LENGTH = 100;

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? '';
}

/** The original extension, kept exactly (".tar.gz" counts as one). Empty when there is none. */
export function extensionOf(filename: string): string {
  const lower = filename.toLowerCase();
  const compound = COMPOUND_EXTENSIONS.find((ext) => lower.endsWith(ext) && lower.length > ext.length);
  if (compound) return filename.slice(-compound.length);
  const match = /(\.[A-Za-z0-9]{1,10})$/.exec(filename);
  return match && match.index > 0 ? match[1]! : '';
}

/**
 * Turn a model suggestion into a safe filename that keeps the original extension.
 * Returns null when nothing usable is left, so the browser keeps its own name.
 */
export function safeFilename(suggestion: string, original: string): string | null {
  const ext = extensionOf(original);
  let base = basename(suggestion.replace(/\\/g, '/')).normalize('NFC');
  // Models often echo the extension back; drop it (or any other) so ours is the only one.
  if (ext && base.toLowerCase().endsWith(ext.toLowerCase())) base = base.slice(0, -ext.length);
  else base = base.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  base = base
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '');
  if (base.length > MAX_BASE_LENGTH) base = base.slice(0, MAX_BASE_LENGTH).replace(/[\s.]+$/, '');
  if (!base) return null;
  if (RESERVED.test(base)) base = `_${base}`;
  return base + ext;
}
