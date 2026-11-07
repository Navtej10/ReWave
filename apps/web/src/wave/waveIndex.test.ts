import { describe, it, expect } from "vitest";
import {
  applyBlipToMeta,
  deriveTitle,
  filterWaves,
  snippetOf,
  sortWaves,
  unreadCount,
  type WaveSummary,
} from "./waveIndex";

// Covers .kiro/specs/06-multi-wave/requirements.md R1.3/R1.4, R4.1/4.2/4.6, R5.1/5.5.

function summary(id: string, patch: Partial<WaveSummary> = {}): WaveSummary {
  return {
    id,
    title: "",
    createdAt: 0,
    lastActivity: 0,
    blipCount: 0,
    lastSnippet: "",
    lastAuthor: "",
    participants: [],
    ...patch,
  };
}

describe("snippetOf", () => {
  it("collapses whitespace to a single line", () => {
    expect(snippetOf("  hello \n\n  world \t ok  ")).toBe("hello world ok");
  });

  it("caps long text with an ellipsis", () => {
    const long = "a".repeat(200);
    const out = snippetOf(long);
    expect(out.length).toBeLessThanOrEqual(140);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("applyBlipToMeta", () => {
  it("creates a record on the first blip with createdAt set to the blip time", () => {
    const meta = applyBlipToMeta(undefined, { author: "Asha", text: "Ship it?", at: 1000 });
    expect(meta).toMatchObject({
      createdAt: 1000,
      lastActivity: 1000,
      blipCount: 1,
      lastSnippet: "Ship it?",
      lastAuthor: "Asha",
      participants: ["Asha"],
      title: "",
    });
  });

  it("bumps count/activity/snippet/author and keeps createdAt", () => {
    const first = applyBlipToMeta(undefined, { author: "Asha", text: "one", at: 1000 });
    const second = applyBlipToMeta(first, { author: "Ben", text: "two", at: 2000 });
    expect(second.createdAt).toBe(1000);
    expect(second.lastActivity).toBe(2000);
    expect(second.blipCount).toBe(2);
    expect(second.lastSnippet).toBe("two");
    expect(second.lastAuthor).toBe("Ben");
  });

  it("adds new authors to participants without duplicating existing ones", () => {
    let meta = applyBlipToMeta(undefined, { author: "Asha", text: "a", at: 1 });
    meta = applyBlipToMeta(meta, { author: "Ben", text: "b", at: 2 });
    meta = applyBlipToMeta(meta, { author: "Asha", text: "c", at: 3 });
    expect(meta.participants).toEqual(["Asha", "Ben"]);
  });

  it("does not mutate the previous record", () => {
    const first = applyBlipToMeta(undefined, { author: "Asha", text: "one", at: 1000 });
    const snapshot = JSON.parse(JSON.stringify(first));
    applyBlipToMeta(first, { author: "Ben", text: "two", at: 2000 });
    expect(first).toEqual(snapshot);
  });
});

describe("deriveTitle", () => {
  it("uses the explicit title when present", () => {
    expect(deriveTitle({ title: "  Launch plan  ", lastSnippet: "ignored" })).toBe("Launch plan");
  });

  it("falls back to the first words of the snippet", () => {
    expect(
      deriveTitle({ title: "", lastSnippet: "Should we ship the beta this Friday or wait" }),
    ).toBe("Should we ship the beta this");
  });

  it("falls back to 'Untitled wave' when there is nothing", () => {
    expect(deriveTitle({ title: "", lastSnippet: "" })).toBe("Untitled wave");
  });
});

describe("sortWaves", () => {
  it("orders by lastActivity descending", () => {
    const out = sortWaves([
      summary("a", { lastActivity: 100 }),
      summary("b", { lastActivity: 300 }),
      summary("c", { lastActivity: 200 }),
    ]);
    expect(out.map((w) => w.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties stably by id", () => {
    const out = sortWaves([
      summary("z", { lastActivity: 100 }),
      summary("a", { lastActivity: 100 }),
    ]);
    expect(out.map((w) => w.id)).toEqual(["a", "z"]);
  });

  it("does not mutate the input array", () => {
    const input = [summary("a", { lastActivity: 1 }), summary("b", { lastActivity: 2 })];
    const copy = [...input];
    sortWaves(input);
    expect(input).toEqual(copy);
  });
});

describe("filterWaves", () => {
  const rows = [
    summary("a", { title: "Launch plan", lastSnippet: "ship the beta" }),
    summary("b", { title: "", lastSnippet: "hiring budget for Q3" }),
    summary("c", { title: "Design review", lastSnippet: "colors and spacing" }),
  ];

  it("returns everything for an empty query", () => {
    expect(filterWaves(rows, "   ").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("matches title case-insensitively", () => {
    expect(filterWaves(rows, "LAUNCH").map((r) => r.id)).toEqual(["a"]);
  });

  it("matches snippet", () => {
    expect(filterWaves(rows, "budget").map((r) => r.id)).toEqual(["b"]);
  });

  it("preserves order of the input", () => {
    expect(filterWaves(rows, "e").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("unreadCount", () => {
  it("is the difference when there is new activity", () => {
    expect(unreadCount(5, 2)).toBe(3);
  });

  it("is zero when caught up", () => {
    expect(unreadCount(5, 5)).toBe(0);
  });

  it("clamps to zero when last-seen is stale/larger", () => {
    expect(unreadCount(3, 10)).toBe(0);
  });
});
