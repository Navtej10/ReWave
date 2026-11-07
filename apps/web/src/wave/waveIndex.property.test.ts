import { describe, it } from "vitest";
import fc from "fast-check";
import { applyBlipToMeta, unreadCount, type WaveMeta } from "./waveIndex";

// Property-based tests for the unread rules (R5.3, R5.5 in
// .kiro/specs/06-multi-wave/requirements.md).

const blipArb = fc.record({
  author: fc.string({ minLength: 1, maxLength: 8 }),
  text: fc.string(),
  at: fc.integer({ min: 0, max: 1_000_000 }),
});

describe("unread (property-based)", () => {
  it("unread is never negative for any blipCount and last-seen", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10_000 }),
        fc.nat({ max: 10_000 }),
        (blipCount, lastSeen) => unreadCount(blipCount, lastSeen) >= 0,
      ),
    );
  });

  it("your own blips are never unread: advancing last-seen on each own blip keeps unread at 0", () => {
    fc.assert(
      fc.property(fc.array(blipArb, { maxLength: 50 }), (blips) => {
        // Simulate a wave where every blip is mine. The own-blip path advances last-seen in
        // lockstep with blipCount (see useWaveIndex.markSeenMine), so unread must stay 0.
        let meta: WaveMeta | undefined;
        let lastSeen = 0;
        for (const blip of blips) {
          meta = applyBlipToMeta(meta, blip);
          lastSeen = meta.blipCount; // mark-seen-mine
          if (unreadCount(meta.blipCount, lastSeen) !== 0) return false;
        }
        return true;
      }),
    );
  });

  it("mixing own and others' blips, unread equals others' blips since you last posted", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ blip: blipArb, mine: fc.boolean() }), { maxLength: 50 }),
        (events) => {
          let meta: WaveMeta | undefined;
          let lastSeen = 0;
          let othersSinceRead = 0;
          for (const { blip, mine } of events) {
            meta = applyBlipToMeta(meta, blip);
            if (mine) {
              lastSeen = meta.blipCount; // own blip marks the whole wave seen
              othersSinceRead = 0; // ...so earlier unread blips clear too
            } else {
              othersSinceRead += 1; // only others' blips count toward unread
            }
            if (unreadCount(meta.blipCount, lastSeen) !== othersSinceRead) return false;
          }
          return true;
        },
      ),
    );
  });
});
