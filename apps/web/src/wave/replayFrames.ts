import { decisionSources } from "./decisionSources";
import type { BlipView, Decision } from "./types";

/** One step of a replay: one blip, and whether the decision cites it. */
export interface ReplayFrame {
  blip: BlipView;
  /** Listed by `decisionSources` for the decision. */
  cited: boolean;
}

/** Which rule decided where the replay ends. */
export type ReplayEnd = "source" | "lastCited" | "threadLength" | "createdAt";

/** Keep the first blip for each non-empty id; skip malformed entries. */
function uniqueBlips(blips: readonly BlipView[]): BlipView[] {
  const seen = new Set<string>();
  const out: BlipView[] = [];
  for (const b of blips) {
    if (!b || typeof b.id !== "string" || b.id === "" || seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  return out;
}

/** Pick the end rule. `endIndex` is an index into `order`; it is unused for the "createdAt" rule. */
function resolveEnd(order: readonly BlipView[], decision: Decision): { rule: ReplayEnd; endIndex: number } {
  const indexOf = new Map(order.map((b, i) => [b.id, i]));
  const isLive = (id: string) => {
    const i = indexOf.get(id);
    return i !== undefined && !order[i].deleted;
  };
  if (decision.sourceBlipId && isLive(decision.sourceBlipId)) {
    return { rule: "source", endIndex: indexOf.get(decision.sourceBlipId)! };
  }
  const cited = decisionSources(decision, order.map((b) => b.id)).filter(isLive);
  if (cited.length > 0) {
    return { rule: "lastCited", endIndex: Math.max(...cited.map((id) => indexOf.get(id)!)) };
  }
  const n = decision.threadLength;
  if (typeof n === "number" && Number.isInteger(n) && n >= 1 && order.length > 0) {
    return { rule: "threadLength", endIndex: Math.min(n, order.length) - 1 };
  }
  return { rule: "createdAt", endIndex: -1 };
}

/** The rule `buildReplayFrames` uses to end this decision's replay (for tests and notices). */
export function replayEnd(blips: readonly BlipView[], decision: Decision): ReplayEnd {
  return resolveEnd(uniqueBlips(blips), decision).rule;
}

/**
 * The blips that build up to a decision, one per frame, in wave order. The replay ends at the
 * decision's source blip, else its last cited blip, else blip number `threadLength`, else the
 * blips written by the time the decision was recorded. Ancestors of every included blip are
 * included (even deleted ones) and always come before their replies.
 */
export function buildReplayFrames(blips: readonly BlipView[], decision: Decision): ReplayFrame[] {
  const order = uniqueBlips(blips);
  const byId = new Map(order.map((b) => [b.id, b]));
  const { rule, endIndex } = resolveEnd(order, decision);

  const included = new Set<string>();
  order.forEach((b, i) => {
    if (b.deleted) return;
    const inside = rule === "createdAt" ? typeof b.createdAt === "number" && b.createdAt <= decision.createdAt : i <= endIndex;
    if (inside) included.add(b.id);
  });

  // Ancestors, so replies are never orphaned. `seen` stops parent loops.
  for (const id of [...included]) {
    const seen = new Set([id]);
    let parent = byId.get(byId.get(id)!.parentId ?? "");
    while (parent && !seen.has(parent.id)) {
      included.add(parent.id);
      seen.add(parent.id);
      parent = byId.get(parent.parentId ?? "");
    }
  }

  // Wave order, except a parent is always emitted before its replies. A parent loop is broken by
  // turning the blip that closes it into a root.
  const done = new Set<string>();
  const frames: ReplayFrame[] = [];
  const citedIds = new Set(decisionSources(decision, order.map((b) => b.id)));
  for (const start of order) {
    if (!included.has(start.id) || done.has(start.id)) continue;
    const chain: BlipView[] = [];
    const inChain = new Set<string>();
    let cur: BlipView | undefined = start;
    let orphan = false;
    while (cur && !done.has(cur.id)) {
      chain.push(cur);
      inChain.add(cur.id);
      const next: BlipView | undefined = cur.parentId ? byId.get(cur.parentId) : undefined;
      if (!next || !included.has(next.id) || done.has(next.id)) break;
      if (inChain.has(next.id)) {
        orphan = true;
        break;
      }
      cur = next;
    }
    chain.reverse().forEach((b, i) => {
      done.add(b.id);
      frames.push({ blip: orphan && i === 0 ? { ...b, parentId: null } : b, cited: citedIds.has(b.id) });
    });
  }
  return frames;
}
