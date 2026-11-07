import type { ReactNode } from 'react';

type Block = { type: 'p' | 'ul' | 'quote'; lines: string[] };

/**
 * Renders model output as text only: paragraphs, "- " bullets, "> " quotes and **bold**. No HTML,
 * links or other markdown are interpreted, so page- or model-derived content cannot inject markup.
 * `inline` may turn parts of each line into elements (citations); `quote` renders a quote block.
 */
export function RichText({
  text,
  inline = (line) => line,
  quote,
}: {
  text: string;
  inline?: (line: string) => ReactNode;
  quote?: (text: string) => ReactNode;
}) {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const last = blocks.at(-1);
    if (!line) {
      blocks.push({ type: 'p', lines: [] });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      if (quoted[1]!.trim()) blocks.push({ type: 'quote', lines: [quoted[1]!.trim()] });
    } else if (bullet) {
      if (last?.type === 'ul') last.lines.push(bullet[1]!);
      else blocks.push({ type: 'ul', lines: [bullet[1]!] });
    } else if (last?.type === 'p' && last.lines.length) {
      last.lines.push(line);
    } else {
      blocks.push({ type: 'p', lines: [line.replace(/^#+\s*/, '')] });
    }
  }

  const format = (line: string) => withBold(line.replace(/`([^`]+)`/g, '$1'), inline);

  return (
    <div className="hm-rich">
      {blocks
        .filter((block) => block.lines.length)
        .map((block, index) => {
          if (block.type === 'quote') {
            const content = block.lines[0]!.replace(/^["“]|["”]$/g, '');
            return quote ? <div key={index}>{quote(content)}</div> : <blockquote key={index}>{content}</blockquote>;
          }
          return block.type === 'ul' ? (
            <ul key={index}>
              {block.lines.map((line, i) => (
                <li key={i}>{format(line)}</li>
              ))}
            </ul>
          ) : (
            <p key={index}>{format(block.lines.join(' '))}</p>
          );
        })}
    </div>
  );
}

/** **bold** becomes <strong>; everything else goes through `inline` as plain text. */
function withBold(line: string, inline: (line: string) => ReactNode): ReactNode {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return inline(line);
  return parts.map((part, i) => (i % 2 ? <strong key={i}>{inline(part)}</strong> : <span key={i}>{inline(part)}</span>));
}
