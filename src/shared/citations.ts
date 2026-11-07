export type CitationPart = { kind: 'text'; text: string } | { kind: 'cite'; n: number };

/** Split model text into plain text and `[n]` citations, keeping only numbers that are real sources. */
export function splitCitations(text: string, validNumbers: ReadonlySet<number>): CitationPart[] {
  const parts: CitationPart[] = [];
  let last = 0;
  for (const match of text.matchAll(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g)) {
    const numbers = match[1]!.split(',').map((value) => Number(value.trim()));
    if (!numbers.every((n) => validNumbers.has(n))) continue;
    if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
    for (const n of numbers) parts.push({ kind: 'cite', n });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}
