import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { appendDecisions, removeDecision } from "./blipModel";
import type { Decision } from "./types";

describe("decision log", () => {
  it("dedupes by source + text and removes by id", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Decision>("decisions");
    let n = 0;
    const id = () => `d${++n}`;
    appendDecisions(arr, [{ text: "Ship Friday", sourceBlipId: "s1" }, { text: "Ship Friday", sourceBlipId: "s1" }], "Asha", 1, id);
    appendDecisions(arr, [{ text: "Ship Friday", sourceBlipId: "s1" }, { text: "Hire QA" }], "Ben", 2, id);
    expect(arr.toArray().map((d) => d.text)).toEqual(["Ship Friday", "Hire QA"]);
    removeDecision(arr, "d1");
    removeDecision(arr, "missing");
    expect(arr.toArray().map((d) => d.text)).toEqual(["Hire QA"]);
  });
});
