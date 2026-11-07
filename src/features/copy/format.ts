/** Markdown link that survives brackets in titles and parentheses in URLs. */
export function markdownLink(title: string, url: string): string {
  const text = (title.trim() || url).replace(/([[\]\\])/g, '\\$1');
  return `[${text}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
}

/** The selected text as a Markdown quote, credited to the page it came from. */
export function markdownQuote(selection: string, title: string, url: string): string {
  const quoted = selection
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`.trimEnd())
    .join('\n');
  return `${quoted}\n>\n> — ${markdownLink(title, url)}`;
}
