import { describe, it, expect } from "vitest";
import {
  joinMembership,
  lastSeenOf,
  leaveMembership,
  markReadMembership,
  parseMemberships,
  serializeMemberships,
  type Membership,
} from "./myWaves";
import { generateWaveId } from "./waveId";

// Covers .kiro/specs/06-multi-wave/requirements.md R1.

const A = generateWaveId();
const B = generateWaveId();

function m(id: string, patch: Partial<Membership> = {}): Membership {
  return { id, joinedAt: 0, lastSeenCount: 0, ...patch };
}

describe("parseMemberships", () => {
  it("returns [] for null / empty / non-array / bad JSON", () => {
    expect(parseMemberships(null)).toEqual([]);
    expect(parseMemberships("")).toEqual([]);
    expect(parseMemberships("not json")).toEqual([]);
    expect(parseMemberships("{}")).toEqual([]);
    expect(parseMemberships("42")).toEqual([]);
  });

  it("drops entries with missing or invalid ids without crashing", () => {
    const raw = JSON.stringify([
      { id: A, joinedAt: 10, lastSeenCount: 2 },
      { id: "index", joinedAt: 1, lastSeenCount: 0 }, // reserved -> dropped
      { id: "short", joinedAt: 1, lastSeenCount: 0 }, // invalid -> dropped
      { joinedAt: 1 }, // no id -> dropped
      null, // junk -> dropped
      "string", // junk -> dropped
    ]);
    expect(parseMemberships(raw)).toEqual([m(A, { joinedAt: 10, lastSeenCount: 2 })]);
  });

  it("coerces non-numeric counts to 0 and de-dupes ids (first wins)", () => {
    const raw = JSON.stringify([
      { id: A, joinedAt: "x", lastSeenCount: -5 },
      { id: A, joinedAt: 99, lastSeenCount: 99 },
    ]);
    expect(parseMemberships(raw)).toEqual([m(A, { joinedAt: 0, lastSeenCount: 0 })]);
  });

  it("round-trips through serialize", () => {
    const list = [m(A, { joinedAt: 5, lastSeenCount: 3 }), m(B, { joinedAt: 7 })];
    expect(parseMemberships(serializeMemberships(list))).toEqual(list);
  });
});

describe("joinMembership", () => {
  it("adds a new wave with joinedAt=now and lastSeenCount=0", () => {
    const out = joinMembership([], A, 1234);
    expect(out).toEqual([m(A, { joinedAt: 1234 })]);
  });

  it("is idempotent: joining an existing wave keeps the original record", () => {
    const start = [m(A, { joinedAt: 1234, lastSeenCount: 4 })];
    const out = joinMembership(start, A, 9999);
    expect(out).toBe(start); // unchanged reference
    expect(out).toEqual([m(A, { joinedAt: 1234, lastSeenCount: 4 })]);
  });

  it("ignores invalid ids", () => {
    expect(joinMembership([], "index", 1)).toEqual([]);
    expect(joinMembership([], "short", 1)).toEqual([]);
  });
});

describe("leaveMembership", () => {
  it("removes a wave by id", () => {
    const out = leaveMembership([m(A), m(B)], A);
    expect(out).toEqual([m(B)]);
  });

  it("returns the list unchanged when the id is absent", () => {
    const start = [m(A)];
    expect(leaveMembership(start, B)).toBe(start);
  });
});

describe("markReadMembership", () => {
  it("sets lastSeenCount for the matching wave", () => {
    const out = markReadMembership([m(A), m(B)], A, 7);
    expect(lastSeenOf(out, A)).toBe(7);
    expect(lastSeenOf(out, B)).toBe(0);
  });

  it("clamps negative counts to 0 and ignores unknown ids", () => {
    const start = [m(A, { lastSeenCount: 3 })];
    expect(lastSeenOf(markReadMembership(start, A, -1), A)).toBe(0);
    expect(markReadMembership(start, B, 5)).toBe(start);
  });
});
