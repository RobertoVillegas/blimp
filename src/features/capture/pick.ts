export interface Candidate {
  width: number;
  height: number;
  tag: string;
  display: string;
}

/**
 * Arc's score for "the thing under the cursor" in Capture: prefer images and big blocks, skip
 * small bits, inline text and anything about the size of the whole view. Below 0 is never picked.
 */
export function scoreCandidate({ width, height, tag, display }: Candidate, view: { width: number; height: number }): number {
  let score = 0;
  if (Math.min(width, height) < 100) score -= 5;
  if (width >= view.width) score -= 5;
  if (height >= view.height) score -= 5;
  if (width * height > view.width * view.height * 0.7) score -= 5;
  if (tag === 'IMG' || tag === 'PICTURE' || tag === 'OBJECT' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'svg') score += 5;
  score += (width + height) / 2 / 500;
  if (display === 'inline') score -= 10;
  return score;
}

/** The best element to capture at this point of the page, ignoring Blimp's own layer. */
export function pickElementAt(x: number, y: number, ignore: Element): Element | undefined {
  const view = { width: innerWidth, height: innerHeight };
  let best: { element: Element; score: number } | undefined;
  for (const element of document.elementsFromPoint(x, y)) {
    if (element === ignore || element === document.documentElement || element === document.body) continue;
    const rect = element.getBoundingClientRect();
    const score = scoreCandidate({ width: rect.width, height: rect.height, tag: element.tagName, display: getComputedStyle(element).display }, view);
    if (score >= 0 && (!best || score > best.score)) best = { element, score };
  }
  return best?.element;
}
