import fc from "fast-check";
import { describe, it } from "vitest";
import { decisionSources } from "./decisionSources";
import { buildReplayFrames } from "./replayFrames";
import type { BlipView, Decision } from "./types";

const idArb = fc.constantFrom("a","b","c","d");

const blipArb = fc.record({
  id: idArb,
  parentId: fc.option(idArb, { nil: null }),
  createdAt: fc.integer({ min: 0, max: 100 }),
  deleted: fc.boolean(),
});

function toBlip(r: { id: string; parentId: string | null; createdAt: number; deleted: boolean }): BlipView {
  return {
    id: r.id,
    parentId: r.parentId,
    author: "Asha",
    kind: "human",
    text: r.id,
    createdAt: r.createdAt,
    sources: [],
    contentKind: "text",
    attachments: [],
    reactions: {},
    stances: {},
    pinned: false,
    editedBy: [],
    deleted: r.deleted,
  };
}

const decisionArb = fc.record({
  id: fc.constant("d"),
  text: fc.array(idArb, { maxLength: 4 }).map((c) => c.map((x) => `claim [b:${x}]`).join(" ")),
  createdAt: fc.integer({ min: 0, max: 100 }),
  author: fc.constant("Asha"),
  sourceBlipId: fc.option(idArb, { nil: undefined }),
  sourceBlipIds: fc.option(fc.array(idArb, { maxLength: 4 }), { nil: undefined }),
  threadLength: fc.option(fc.integer({ min: -2, max: 30 }), { nil: undefined }),
}) as fc.Arbitrary<Decision>;

// A tiny id alphabet makes duplicate ids and parent cycles common. Arbitrary parent links: unknown parents, forward references, duplicate ids and cycles all occur.
const wave = fc.array(blipArb, { maxLength: 15 });

describe("buildReplayFrames (property)", () => {
  it("puts every frame's parent earlier in the list, or the parent is absent from the wave", () => {
    fc.assert(
      fc.property(wave, decisionArb, (rows, decision) => {
        const blips = rows.map(toBlip);
        const inWave = new Set(blips.map((b) => b.id));
        const frames = buildReplayFrames(blips, decision);
        const position = new Map(frames.map((f, i) => [f.blip.id, i]));
        return frames.every((f, i) => {
          const parent = f.blip.parentId;
          if (parent === null || !inWave.has(parent)) return true;
          const at = position.get(parent);
          return at !== undefined && at < i;
        });
      }),
    );
  });

  it("never has more frames than blips, and never repeats a blip", () => {
    fc.assert(
      fc.property(wave, decisionArb, (rows, decision) => {
        const blips = rows.map(toBlip);
        const frames = buildReplayFrames(blips, decision);
        const unique = new Set(frames.map((f) => f.blip.id));
        return frames.length <= blips.length && unique.size === frames.length;
      }),
    );
  });

  it("flags exactly the cited blips that have a frame", () => {
    fc.assert(
      fc.property(wave, decisionArb, (rows, decision) => {
        const blips = rows.map(toBlip);
        const frames = buildReplayFrames(blips, decision);
        const cited = new Set(decisionSources(decision, blips.map((b) => b.id)));
        return frames.every((f) => f.cited === cited.has(f.blip.id));
      }),
    );
  });
});
