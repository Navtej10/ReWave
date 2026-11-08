import { describe, it } from "vitest";
import fc from "fast-check";
import {
  isMember,
  joinMembership,
  leaveMembership,
  parseMemberships,
  serializeMemberships,
  type Membership,
} from "./myWaves";
import { generateWaveId } from "./waveId";

// Property-based tests for the membership rules
// (.kiro/specs/06-multi-wave/requirements.md R1.2/R1.3/R1.4).

// A pool of real (valid) wave ids to draw from, so join/leave operate on legal input.
const idPool = Array.from({ length: 12 }, () => generateWaveId());
const idArb = fc.constantFrom(...idPool);

describe("membership (property-based)", () => {
  it("join is idempotent: joining the same id any number of times yields one entry", () => {
    fc.assert(
      fc.property(idArb, fc.nat({ max: 10 }), (id, times) => {
        let list: Membership[] = [];
        for (let i = 0; i < times + 1; i++) list = joinMembership(list, id, i);
        return list.filter((m) => m.id === id).length === 1;
      }),
    );
  });

  it("leave removes the id; afterwards isMember is false", () => {
    fc.assert(
      fc.property(fc.array(idArb), idArb, (joins, target) => {
        let list: Membership[] = [];
        for (const id of joins) list = joinMembership(list, id, 0);
        list = leaveMembership(list, target);
        return !isMember(list, target);
      }),
    );
  });

  it("join then leave returns to not-a-member regardless of order of other ops", () => {
    fc.assert(
      fc.property(fc.array(idArb), idArb, (others, target) => {
        let list: Membership[] = joinMembership([], target, 0);
        for (const id of others) list = joinMembership(list, id, 0);
        list = leaveMembership(list, target);
        return !isMember(list, target);
      }),
    );
  });

  it("parseMemberships never throws on arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        parseMemberships(raw);
        return true;
      }),
    );
  });

  it("serialize -> parse is a round trip for any joined set", () => {
    fc.assert(
      fc.property(fc.array(idArb), (joins) => {
        let list: Membership[] = [];
        for (const id of joins) list = joinMembership(list, id, 1);
        const round = parseMemberships(serializeMemberships(list));
        return (
          round.length === list.length &&
          round.every((r, i) => r.id === list[i].id && r.lastSeenCount === list[i].lastSeenCount)
        );
      }),
    );
  });
});
