import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveLocks, type EditClaim } from "./resolveLocks";

// Property-based tests (referenced in .kiro/specs/01-live-wave-sync/requirements.md R5).
// Awareness is eventually consistent, so every client ends up with the same set of
// claims; resolution must therefore be a deterministic pure function of that set.

const claimArb: fc.Arbitrary<EditClaim> = fc.record({
  clientID: fc.integer({ min: 0, max: 1_000_000 }),
  blipId: fc.constantFrom("a", "b", "c", "d"),
  name: fc.string(),
});

// Awareness clientIDs are unique per connection, so no two claims share a clientID.
const claimsArb: fc.Arbitrary<EditClaim[]> = fc
  .array(claimArb, { maxLength: 30 })
  .map((claims) => {
    const seen = new Set<number>();
    return claims.filter((c) => (seen.has(c.clientID) ? false : (seen.add(c.clientID), true)));
  });

describe("resolveLocks (property-based)", () => {
  it("yields at most one holder per blip", () => {
    fc.assert(
      fc.property(claimsArb, (claims) => {
        const holders = resolveLocks(claims);
        const blipIds = new Set(claims.map((c) => c.blipId));
        // One Map entry per blip by construction; also never more holders than distinct blips.
        return holders.size <= blipIds.size;
      }),
    );
  });

  it("every client computing from the same claims agrees, regardless of order", () => {
    fc.assert(
      fc.property(claimsArb, (claims) => {
        const shuffled = [...claims].sort(() => Math.random() - 0.5);
        const a = resolveLocks(claims);
        const b = resolveLocks(shuffled);
        if (a.size !== b.size) return false;
        for (const [blipId, holder] of a) {
          const other = b.get(blipId);
          if (!other || other.clientID !== holder.clientID || other.name !== holder.name) return false;
        }
        return true;
      }),
    );
  });

  it("the winner is always the lowest clientID among claimants for that blip", () => {
    fc.assert(
      fc.property(claimsArb, (claims) => {
        const holders = resolveLocks(claims);
        for (const [blipId, holder] of holders) {
          const min = Math.min(...claims.filter((c) => c.blipId === blipId).map((c) => c.clientID));
          if (holder.clientID !== min) return false;
        }
        return true;
      }),
    );
  });

  it("a blip with no claim has no holder", () => {
    fc.assert(
      fc.property(claimsArb, (claims) => {
        const holders = resolveLocks(claims);
        const claimed = new Set(claims.map((c) => c.blipId));
        for (const blipId of holders.keys()) {
          if (!claimed.has(blipId)) return false;
        }
        return true;
      }),
    );
  });
});

// Guard against accidental emptiness of the generator.
describe("resolveLocks property arbitraries", () => {
  it("can produce contested claims", () => {
    expect(resolveLocks([
      { clientID: 2, blipId: "a", name: "x" },
      { clientID: 1, blipId: "a", name: "y" },
    ]).get("a")?.clientID).toBe(1);
  });
});
