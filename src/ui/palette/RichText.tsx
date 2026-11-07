import type { ReactNode } from 'react';

/**
 * Renders model output as text only: paragraphs and "- " bullets. No HTML, links or markdown
 * are interpreted, so page-derived or model-derived content cannot inject markup.
 * `inline` may turn parts of each line into elements (citations), still from plain text.
 */
export function RichText({ text, inline = (line) => line }: { text: string; inline?: (line: string) => ReactNode }) {
  const blocks: { type: 'p' | 'ul'; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ type: 'p', lines: [] });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const last = blocks.at(-1);
    if (bullet) {
      if (last?.type === 'ul') last.lines.push(bullet[1]!);
      else blocks.push({ type: 'ul', lines: [bullet[1]!] });
    } else if (last?.type === 'p' && last.lines.length) {
      last.lines.push(line);
    } else {
      blocks.push({ type: 'p', lines: [line.replace(/^#+\s*/, '')] });
    }
  }

  return (
    <div className="hm-rich">
      {blocks
        .filter((block) => block.lines.length)
        .map((block, index) =>
          block.type === 'ul' ? (
            <ul key={index}>
              {block.lines.map((line, i) => (
                <li key={i}>{inline(stripEmphasis(line))}</li>
              ))}
            </ul>
          ) : (
            <p key={index}>{inline(stripEmphasis(block.lines.join(' ')))}</p>
          ),
        )}
    </div>
  );
}

function stripEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}
