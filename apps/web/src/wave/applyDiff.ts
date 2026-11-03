import type * as Y from "yjs";

/**
 * Applies a minimal edit (common prefix/suffix) to a Y.Text so two people typing in
 * the same blip merge character-by-character instead of overwriting each other.
 */
export function applyDiff(ytext: Y.Text, next: string): void {
  const prev = ytext.toString();
  if (prev === next) return;

  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;

  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }

  const run = () => {
    if (endPrev > start) ytext.delete(start, endPrev - start);
    if (endNext > start) ytext.insert(start, next.slice(start, endNext));
  };
  ytext.doc ? ytext.doc.transact(run) : run();
}
