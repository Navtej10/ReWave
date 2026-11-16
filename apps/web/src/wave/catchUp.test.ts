import { describe, expect, it } from "vitest";
import { loadLastVisit, newSince, saveLastVisit, type KeyValueStore } from "./catchUp";
import type { BlipView } from "./types";

function blip(id: string, author: string, createdAt: number, deleted = false): BlipView {
  return {
    id, parentId: null, author, kind: "human", text: id, createdAt, sources: [], contentKind: "text",
    attachments: [], reactions: {}, stances: {}, pinned: false, editedBy: [], deleted,
  };
}

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("newSince", () => {
  const blips = [blip("a", "Asha", 100), blip("b", "Ben", 200), blip("c", "Ben", 300, true), blip("d", "asha", 400)];
  it("returns nothing on a first visit", () => {
    expect(newSince(blips, null, "Me")).toEqual([]);
  });
  it("keeps newer blips from other people and skips deleted ones", () => {
    expect(newSince(blips, 150, "Asha").map((b) => b.id)).toEqual(["b"]);
  });
});

describe("last visit storage", () => {
  it("round-trips per wave", () => {
    const s = memoryStore();
    expect(loadLastVisit(s, "w1")).toBeNull();
    saveLastVisit(s, "w1", 123);
    expect(loadLastVisit(s, "w1")).toBe(123);
    expect(loadLastVisit(s, "w2")).toBeNull();
  });
});
