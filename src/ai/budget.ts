/** Cap text at roughly `maxTokens` (≈4 chars/token), preferring a line break. */
export function truncateToTokens(text: string, maxTokens: number): { text: string; truncated: boolean } {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return { text, truncated: false };
  const cut = text.slice(0, maxChars);
  const lastBreak = cut.lastIndexOf('\n');
  return { text: lastBreak > maxChars * 0.8 ? cut.slice(0, lastBreak) : cut, truncated: true };
}
