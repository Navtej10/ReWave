// The wave's replay-caption cache: a "replays" Y.Map in the wave's own Y.Doc, keyed by decision id.
// Values are plain JSON ({ captions, generatedAt, frameCount }). No global index; this travels only
// with the wave's own sync. Pure helpers over a Y.Map, no React.
import * as Y from "yjs";
import { parseReplayEntry, type ReplayEntry } from "./replayCaptions";

/** Every valid entry in the map, by decision id. Malformed entries are skipped. */
export function readReplays(map: Y.Map<unknown>): Record<string, ReplayEntry> {
  const out: Record<string, ReplayEntry> = {};
  map.forEach((raw, decisionId) => {
    const entry = parseReplayEntry(raw);
    if (entry) out[decisionId] = entry;
  });
  return out;
}

/**
 * Store captions for a decision and return the entry now in effect. Writes only when there is no
 * valid entry yet, or the stored one was made for a different frame count (stale), or `force` is set
 * (Regenerate). So when two people open the same replay at once, the second response finds the
 * first one's entry and keeps it; both end up showing one version.
 */
export function saveReplay(map: Y.Map<unknown>, decisionId: string, entry: ReplayEntry, force = false): ReplayEntry {
  const existing = parseReplayEntry(map.get(decisionId));
  if (!force && existing && existing.frameCount === entry.frameCount) return existing;
  map.set(decisionId, entry);
  return entry;
}
