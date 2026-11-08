import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateWaveId, isValidWaveId } from "./waveId";

// Property-based tests for .kiro/specs/07-share-links/requirements.md R1.3, R2.3, R7.4.

/**
 * The server's validity rule, mirrored here verbatim from apps/collab/src/index.ts
 * (which in turn mirrors src/wave/waveId.ts — the source of truth). This test asserts the
 * two rules agree so they cannot drift: any string the client rejects, the server also
 * rejects, and vice versa.
 */
const SERVER_WAVE_ID_RE = /^[A-Za-z0-9_-]{22}$/;
const SERVER_RESERVED = new Set(["index"]);
function serverIsValidWaveId(name: string): boolean {
  if (typeof name !== "string") return false;
  if (SERVER_RESERVED.has(name)) return false;
  return SERVER_WAVE_ID_RE.test(name);
}

describe("waveId (property-based)", () => {
  it("every generated id is valid", () => {
    fc.assert(
      fc.property(fc.integer(), () => isValidWaveId(generateWaveId())),
      { numRuns: 1000 },
    );
  });

  it("client and server validity rules agree for any string", () => {
    fc.assert(
      fc.property(fc.string(), (s) => isValidWaveId(s) === serverIsValidWaveId(s)),
    );
  });

  it("any string rejected by isValidWaveId is rejected by the server rule", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        if (!isValidWaveId(s)) return serverIsValidWaveId(s) === false;
        return true;
      }),
    );
  });

  it("explicitly: 'index' and the empty string are rejected by both", () => {
    expect(isValidWaveId("index")).toBe(false);
    expect(serverIsValidWaveId("index")).toBe(false);
    expect(isValidWaveId("")).toBe(false);
    expect(serverIsValidWaveId("")).toBe(false);
  });
});
