import { describe, it, expect } from "vitest";
import {
  buildInviteLink,
  generateWaveId,
  isValidWaveId,
  parseWaveIdFromHash,
  WAVE_ID_LENGTH,
} from "./waveId";

// Covers .kiro/specs/07-share-links/requirements.md R1, R2, R3.

describe("generateWaveId", () => {
  it("produces ids of the fixed url-safe-base64 length and charset", () => {
    for (let i = 0; i < 500; i++) {
      const id = generateWaveId();
      expect(id).toHaveLength(WAVE_ID_LENGTH);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      // No base64 padding or non-url-safe chars leaked through.
      expect(id).not.toContain("=");
      expect(id).not.toContain("+");
      expect(id).not.toContain("/");
    }
  });

  it("is unique across a large batch (collisions negligible at 128 bits)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(generateWaveId());
    expect(seen.size).toBe(10_000);
  });
});

describe("isValidWaveId", () => {
  it("accepts every generated id", () => {
    for (let i = 0; i < 500; i++) {
      expect(isValidWaveId(generateWaveId())).toBe(true);
    }
  });

  it("rejects the empty string", () => {
    expect(isValidWaveId("")).toBe(false);
  });

  it("rejects the reserved name 'index'", () => {
    expect(isValidWaveId("index")).toBe(false);
  });

  it("rejects too-short ids", () => {
    expect(isValidWaveId("abc")).toBe(false);
    expect(isValidWaveId("a".repeat(WAVE_ID_LENGTH - 1))).toBe(false);
  });

  it("rejects too-long ids", () => {
    expect(isValidWaveId("a".repeat(WAVE_ID_LENGTH + 1))).toBe(false);
  });

  it("rejects ids with characters outside the url-safe alphabet", () => {
    expect(isValidWaveId("a".repeat(WAVE_ID_LENGTH - 1) + "+")).toBe(false);
    expect(isValidWaveId("a".repeat(WAVE_ID_LENGTH - 1) + "/")).toBe(false);
    expect(isValidWaveId("a".repeat(WAVE_ID_LENGTH - 1) + "=")).toBe(false);
    expect(isValidWaveId("a".repeat(WAVE_ID_LENGTH - 1) + " ")).toBe(false);
  });
});

describe("buildInviteLink", () => {
  it("builds `${origin}/#${waveId}`", () => {
    const id = generateWaveId();
    // jsdom-free test env: location.origin resolves via the global URL set by Vitest/node.
    expect(buildInviteLink(id)).toBe(`${location.origin}/#${id}`);
  });
});

describe("parseWaveIdFromHash", () => {
  it("round-trips a plain `#<id>` link", () => {
    const id = generateWaveId();
    expect(parseWaveIdFromHash(`#${id}`)).toBe(id);
  });

  it("recovers the id from the legacy `#<id>/<name>` form", () => {
    const id = generateWaveId();
    expect(parseWaveIdFromHash(`#${id}/Asha`)).toBe(id);
  });

  it("returns null for an empty hash", () => {
    expect(parseWaveIdFromHash("")).toBeNull();
    expect(parseWaveIdFromHash("#")).toBeNull();
  });
});
