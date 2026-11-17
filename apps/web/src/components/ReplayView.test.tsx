import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReplayEntry } from "../wave/replayCaptions";
import type { BlipView, Decision } from "../wave/types";
import { ReplayView } from "./ReplayView";

function blip(id: string, parentId: string | null, text: string, extra: Partial<BlipView> = {}): BlipView {
  return {
    id,
    parentId,
    author: "Asha",
    kind: "human",
    text,
    createdAt: 1,
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

const blips = [blip("a", null, "Ship Friday?"), blip("b", "a", "QA needs Monday."), blip("c", "b", "Fine, Monday.")];
const decision: Decision = { id: "d1", text: "Ship on Monday [b:b]", createdAt: 5, author: "Asha", sourceBlipId: "c", sourceBlipIds: ["b"] };
const noop = () => {};
const save = (_id: string, entry: ReplayEntry) => entry;

describe("ReplayView (server render smoke test)", () => {
  it("opens on the first blip with the keystroke note, controls and a loading caption", () => {
    const html = renderToStaticMarkup(<ReplayView decision={decision} blips={blips} onSaveCaptions={save} onClose={noop} />);
    expect(html).toContain("Replay shows each blip in its final text, not every keystroke.");
    expect(html).toContain("Ship Friday?");
    expect(html).not.toContain("QA needs Monday.");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Writing captions");
    expect(html).toContain('aria-label="Replay position"');
    expect(html).toContain("Regenerate captions");
    expect(html).not.toContain('aria-label="Decision"'); // only on the last frame
  });

  it("uses a fresh cached caption without asking for new ones", () => {
    const cached: ReplayEntry = { captions: [{ atBlipId: "a", text: "Asha proposes Friday." }], generatedAt: 1, frameCount: 3 };
    const html = renderToStaticMarkup(<ReplayView decision={decision} blips={blips} cached={cached} onSaveCaptions={save} onClose={noop} />);
    expect(html).toContain("Asha proposes Friday.");
    expect(html).not.toContain("Writing captions");
  });

  it("ignores a stale cached entry", () => {
    const stale: ReplayEntry = { captions: [{ atBlipId: "a", text: "Old caption." }], generatedAt: 1, frameCount: 9 };
    const html = renderToStaticMarkup(<ReplayView decision={decision} blips={blips} cached={stale} onSaveCaptions={save} onClose={noop} />);
    expect(html).not.toContain("Old caption.");
    expect(html).toContain("Writing captions");
  });

  it("says so when there is nothing to replay, and does not crash on a deleted or orphaned blip", () => {
    const empty = renderToStaticMarkup(<ReplayView decision={{ ...decision, sourceBlipId: undefined, sourceBlipIds: [] }} blips={[]} onSaveCaptions={save} onClose={noop} />);
    expect(empty).toContain("There are no blips to replay for this decision.");
    const odd = [blip("a", "gone", "Orphan", { deleted: true }), blip("b", "a", "Reply to deleted")];
    expect(() =>
      renderToStaticMarkup(<ReplayView decision={{ ...decision, sourceBlipId: "b", sourceBlipIds: ["b"] }} blips={odd} onSaveCaptions={save} onClose={noop} />),
    ).not.toThrow();
  });
});
