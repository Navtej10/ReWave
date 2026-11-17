import { describe, expect, it } from "vitest";
import { buildReplayFrames, replayEnd } from "./replayFrames";
import type { BlipView, Decision } from "./types";

function blip(id: string, parentId: string | null = null, extra: Partial<BlipView> = {}): BlipView {
  return {
    id,
    parentId,
    author: "Asha",
    kind: "human",
    text: `text ${id}`,
    createdAt: 1000 + id.charCodeAt(0),
    sources: [],
    contentKind: "text",
    attachments: [],
    reactions: {},
    stances: {},
    pinned: false,
    editedBy: [],
    deleted: false,
    ...extra,
  };
}

function decision(extra: Partial<Decision> = {}): Decision {
  return { id: "d1", text: "Ship it", createdAt: 5000, author: "Asha", ...extra };
}

const ids = (frames: { blip: BlipView }[]) => frames.map((f) => f.blip.id);
const thread = [blip("a"), blip("b"), blip("c", "b"), blip("d"), blip("e")];

describe("buildReplayFrames end rules", () => {
  it("ends at the source card blip", () => {
    const d = decision({ sourceBlipId: "c", sourceBlipIds: ["a"], threadLength: 5 });
    expect(replayEnd(thread, d)).toBe("source");
    expect(ids(buildReplayFrames(thread, d))).toEqual(["a", "b", "c"]);
  });

  it("ends at the last cited blip when there is no source blip", () => {
    const d = decision({ text: "Ship [b:a] [b:d]", threadLength: 2 });
    expect(replayEnd(thread, d)).toBe("lastCited");
    expect(ids(buildReplayFrames(thread, d))).toEqual(["a", "b", "c", "d"]);
  });

  it("uses stored sourceBlipIds before text markers", () => {
    const d = decision({ text: "Ship [b:e]", sourceBlipIds: ["b"] });
    expect(ids(buildReplayFrames(thread, d))).toEqual(["a", "b"]);
  });

  it("falls back to threadLength as a 1-based blip number", () => {
    const d = decision({ threadLength: 4 });
    expect(replayEnd(thread, d)).toBe("threadLength");
    expect(ids(buildReplayFrames(thread, d))).toEqual(["a", "b", "c", "d"]);
  });

  it("clamps threadLength to the wave length", () => {
    expect(ids(buildReplayFrames(thread, decision({ threadLength: 99 })))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("ignores a threadLength below 1 or not an integer", () => {
    expect(replayEnd(thread, decision({ threadLength: 0 }))).toBe("createdAt");
    expect(replayEnd(thread, decision({ threadLength: 2.5 }))).toBe("createdAt");
  });

  it("falls back to blips created at or before the decision", () => {
    const timed = [blip("a", null, { createdAt: 10 }), blip("b", null, { createdAt: 20 }), blip("c", null, { createdAt: 30 })];
    const d = decision({ createdAt: 20 });
    expect(replayEnd(timed, d)).toBe("createdAt");
    expect(ids(buildReplayFrames(timed, d))).toEqual(["a", "b"]);
  });

  it("returns no frames when nothing qualifies", () => {
    expect(buildReplayFrames([], decision())).toEqual([]);
    expect(buildReplayFrames(thread, decision({ createdAt: 1 }))).toEqual([]);
  });
});

describe("buildReplayFrames ancestors", () => {
  it("includes the ancestors of the end blip", () => {
    const deep = [blip("a"), blip("x"), blip("b", "a"), blip("c", "b"), blip("y")];
    expect(ids(buildReplayFrames(deep, decision({ sourceBlipId: "c" })))).toEqual(["a", "x", "b", "c"]);
  });

  it("includes an ancestor that lies past the end point, before its reply", () => {
    // Replies stored before their parent (odd order) still come after the parent.
    const odd = [blip("child", "parent"), blip("parent")];
    expect(ids(buildReplayFrames(odd, decision({ sourceBlipId: "child" })))).toEqual(["parent", "child"]);
  });

  it("keeps a deleted ancestor so replies are not orphaned", () => {
    const withDeleted = [blip("a", null, { deleted: true }), blip("b", "a"), blip("c")];
    const frames = buildReplayFrames(withDeleted, decision({ sourceBlipId: "b" }));
    expect(ids(frames)).toEqual(["a", "b"]);
    expect(frames[0].blip.deleted).toBe(true);
  });

  it("includes ancestors for the createdAt rule", () => {
    const timed = [blip("a", null, { createdAt: 99 }), blip("b", "a", { createdAt: 10 })];
    expect(ids(buildReplayFrames(timed, decision({ createdAt: 10 })))).toEqual(["a", "b"]);
  });
});

describe("buildReplayFrames cited flags", () => {
  it("marks exactly the blips the decision cites", () => {
    const d = decision({ sourceBlipId: "d", sourceBlipIds: ["b", "zzz"] });
    const frames = buildReplayFrames(thread, d);
    expect(frames.map((f) => [f.blip.id, f.cited])).toEqual([
      ["a", false],
      ["b", true],
      ["c", false],
      ["d", false],
    ]);
  });

  it("reads [b:id] markers on legacy decisions", () => {
    const frames = buildReplayFrames(thread, decision({ text: "Go [b:c]" }));
    expect(frames.filter((f) => f.cited).map((f) => f.blip.id)).toEqual(["c"]);
  });
});

describe("buildReplayFrames missing and deleted blips", () => {
  it("skips a deleted blip that is not an ancestor", () => {
    const withDeleted = [blip("a"), blip("b", null, { deleted: true }), blip("c")];
    expect(ids(buildReplayFrames(withDeleted, decision({ sourceBlipId: "c" })))).toEqual(["a", "c"]);
  });

  it("ignores a source blip that does not exist or is deleted", () => {
    expect(replayEnd(thread, decision({ sourceBlipId: "gone", threadLength: 2 }))).toBe("threadLength");
    const withDeleted = [blip("a"), blip("b", null, { deleted: true }), blip("c")];
    expect(replayEnd(withDeleted, decision({ sourceBlipId: "b", text: "x [b:a]" }))).toBe("lastCited");
  });

  it("ignores cited ids that are missing", () => {
    const frames = buildReplayFrames(thread, decision({ sourceBlipIds: ["gone", "b"] }));
    expect(ids(frames)).toEqual(["a", "b"]);
  });

  it("treats a reply whose parent is missing as a root", () => {
    const frames = buildReplayFrames([blip("a", "gone"), blip("b", "a")], decision({ sourceBlipId: "b" }));
    expect(ids(frames)).toEqual(["a", "b"]);
  });

  it("does not loop on a parent cycle and breaks it", () => {
    const frames = buildReplayFrames([blip("a", "b"), blip("b", "a")], decision({ sourceBlipId: "b" }));
    expect(ids(frames).sort()).toEqual(["a", "b"]);
    expect(frames[0].blip.parentId).toBeNull();
  });

  it("handles a self-parented blip", () => {
    expect(ids(buildReplayFrames([blip("a", "a")], decision({ sourceBlipId: "a" })))).toEqual(["a"]);
  });

  it("keeps the first of duplicate ids and skips entries without an id", () => {
    const bad = [blip("a"), blip("a", null, { text: "dupe" }), blip(""), undefined as unknown as BlipView];
    const frames = buildReplayFrames(bad, decision({ threadLength: 4 }));
    expect(ids(frames)).toEqual(["a"]);
    expect(frames[0].blip.text).toBe("text a");
  });

  it("does not mutate its input", () => {
    const input = [blip("a", "b"), blip("b", "a")];
    const copy = JSON.stringify(input);
    buildReplayFrames(input, decision({ sourceBlipId: "a" }));
    expect(JSON.stringify(input)).toBe(copy);
  });
});
