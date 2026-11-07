/** Compare text the way a reader would: ignore case, curly vs straight quotes, dash style and spacing. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lines the model marked as verbatim quotes ("> …"), without the marker or wrapping quotes. */
export function quoteLines(answer: string): string[] {
  return answer
    .split("\n")
    .map((line) => /^\s*>\s?(.*)$/.exec(line)?.[1]?.trim() ?? "")
    .map((quote) =>
      quote
        .replace(/^["“'‘]+|["”'’]+$/g, "")
        .replace(/^\.\.\.|\.\.\.$|^…|…$/g, "")
        .trim(),
    )
    .filter((quote) => quote.length >= 8);
}

/** Which quotes really appear in the page text. */
export function verifyQuotes(
  answer: string,
  pageText: string,
): { text: string; found: boolean }[] {
  const haystack = normalizeForMatch(pageText);
  return quoteLines(answer).map((text) => ({
    text,
    found: haystack.includes(normalizeForMatch(text)),
  }));
}
