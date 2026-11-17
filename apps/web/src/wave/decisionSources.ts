import { citedIds } from "./agents";
import type { Decision } from "./types";

/**
 * Blip ids a decision traces back to: `sourceBlipIds` when stored, otherwise the `[b:id]`
 * markers in its text (legacy decisions). Only ids in `blipIds` survive, de-duplicated and
 * in thread order (the order of `blipIds`).
 */
export function decisionSources(
  decision: Pick<Decision, "text" | "sourceBlipIds">,
  blipIds: readonly string[],
): string[] {
  const wanted = new Set(decision.sourceBlipIds ?? citedIds(decision.text));
  const out: string[] = [];
  for (const id of blipIds) {
    if (wanted.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}
