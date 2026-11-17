import { describe, expect, it } from "vitest";
import { decisionSources } from "./decisionSources";

const blips = ["a1", "b2", "c3"];

describe("decisionSources", () => {
  it("prefers the stored sourceBlipIds over the text markers", () => {
    expect(decisionSources({ text: "Ship [b:a1]", sourceBlipIds: ["c3"] }, blips)).toEqual(["c3"]);
  });

  it("falls back to [b:id] markers for legacy decisions", () => {
    expect(decisionSources({ text: "Ship Friday [b:b2] and [b:a1]" }, blips)).toEqual(["a1", "b2"]);
  });

  it("drops ids that are not blips", () => {
    expect(decisionSources({ text: "x [b:zzz] [b:a1]" }, blips)).toEqual(["a1"]);
    expect(decisionSources({ text: "x", sourceBlipIds: ["zzz", "b2"] }, blips)).toEqual(["b2"]);
  });

  it("de-duplicates", () => {
    expect(decisionSources({ text: "[b:a1] [b:a1]" }, blips)).toEqual(["a1"]);
    expect(decisionSources({ text: "x", sourceBlipIds: ["b2", "b2"] }, blips)).toEqual(["b2"]);
  });

  it("returns nothing when there are no sources", () => {
    expect(decisionSources({ text: "Hire QA" }, blips)).toEqual([]);
    expect(decisionSources({ text: "Hire QA", sourceBlipIds: [] }, blips)).toEqual([]);
  });
});
