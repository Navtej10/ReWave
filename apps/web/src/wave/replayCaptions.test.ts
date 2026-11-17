import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  captionAt,
  isFresh,
  MAX_REPLAY_CAPTION_CHARS,
  narrate,
  narrateErrorMessage,
  narrationRequest,
  parseReplayEntry,
  sanitizeCaptions,
  type ReplayEntry,
} from "./replayCaptions";
import type { ReplayFrame } from "./replayFrames";
import { readReplays, saveReplay } from "./replays";
import type { BlipView } from "./types";

const ids = ["a", "b", "c", "d", "e", "f", "g"];
const cap = (atBlipId: string, text = "Something happens.") => ({ atBlipId, text });

function frame(id: string, extra: Partial<BlipView> = {}): ReplayFrame {
  return {
    cited: false,
    blip: {
      id,
      parentId: null,
      author: "Asha",
      kind: "human",
      text: `text ${id}`,
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
    },
  };
}

describe("sanitizeCaptions", () => {
  it("drops unknown ids, duplicates and empty text", () => {
    const out = sanitizeCaptions([cap("a"), cap("zzz"), cap("a", "again"), cap("b", "  "), cap("c")], ids);
    expect(out.map((c) => c.atBlipId)).toEqual(["a", "c"]);
  });

  it("orders by frame position and caps the count", () => {
    const out = sanitizeCaptions([...ids].reverse().map((id) => cap(id)), ids);
    expect(out.map((c) => c.atBlipId)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("caps text length and strips citations", () => {
    expect(sanitizeCaptions([cap("a", "x".repeat(900))], ids)[0].text.length).toBeLessThanOrEqual(MAX_REPLAY_CAPTION_CHARS);
    expect(sanitizeCaptions([cap("a", "Asha [b:b] agrees.")], ids)[0].text).toBe("Asha agrees.");
  });

  it("accepts the API body shape and survives garbage", () => {
    expect(sanitizeCaptions({ captions: [cap("b")] }, ids)).toEqual([cap("b")]);
    for (const junk of [null, undefined, 3, "x", {}, { captions: 4 }, [null, 1, "a", {}, { atBlipId: 5, text: "x" }]]) {
      expect(sanitizeCaptions(junk, ids)).toEqual([]);
    }
  });
});

describe("parseReplayEntry / isFresh", () => {
  const good: ReplayEntry = { captions: [cap("a")], generatedAt: 5, frameCount: 3 };

  it("accepts a well-formed entry", () => {
    expect(parseReplayEntry(good)).toEqual(good);
  });

  it("rejects malformed entries without throwing", () => {
    const bad: unknown[] = [
      null,
      "x",
      {},
      { ...good, captions: "no" },
      { ...good, generatedAt: "now" },
      { ...good, frameCount: -1 },
      { ...good, frameCount: 1.5 },
      { ...good, captions: [{ atBlipId: 1, text: "x" }, null] },
    ];
    for (const b of bad) expect(parseReplayEntry(b)).toBeNull();
  });

  it("drops bad captions but keeps good ones", () => {
    expect(parseReplayEntry({ ...good, captions: [null, cap("a"), { atBlipId: "b" }] })?.captions).toEqual([cap("a")]);
  });

  it("is fresh only for the same frame count", () => {
    expect(isFresh(good, 3)).toBe(true);
    expect(isFresh(good, 4)).toBe(false);
    expect(isFresh(null, 3)).toBe(false);
  });
});

describe("captionAt", () => {
  const captions = [cap("b", "B"), cap("e", "E")];
  it("is null before the first caption", () => {
    expect(captionAt(ids, captions, 0)).toBeNull();
  });
  it("keeps the latest caption until the next one", () => {
    expect(captionAt(ids, captions, 1)?.text).toBe("B");
    expect(captionAt(ids, captions, 3)?.text).toBe("B");
    expect(captionAt(ids, captions, 4)?.text).toBe("E");
    expect(captionAt(ids, captions, 6)?.text).toBe("E");
  });
  it("ignores captions for blips that are not frames", () => {
    expect(captionAt(["a"], [cap("zzz")], 0)).toBeNull();
  });
});

describe("narrationRequest", () => {
  it("sends only the frame blips, hides deleted text, and strips citations from the decision", () => {
    const body = narrationRequest([frame("a"), frame("b", { deleted: true, text: "secret", parentId: "a" })], "Ship [b:a]  Friday");
    expect(body.blips).toEqual([
      { id: "a", author: "Asha", text: "text a", parentId: null },
      { id: "b", author: "Asha", text: "(deleted)", parentId: "a" },
    ]);
    expect(body.decision).toBe("Ship Friday");
  });
});

describe("narrate", () => {
  const frames = [frame("a"), frame("b")];
  const reply = (status: number, body: unknown) => vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

  it("returns validated captions", async () => {
    const fetchImpl = reply(200, { captions: [cap("b", "B"), cap("zzz"), cap("a", "A")] });
    expect((await narrate(frames, "Ship", fetchImpl as unknown as typeof fetch)).map((c) => c.atBlipId)).toEqual(["a", "b"]);
    expect(fetchImpl).toHaveBeenCalledWith("/api/agents/narrate", expect.objectContaining({ method: "POST" }));
  });

  it("fails with a plain message on HTTP errors, network errors and empty answers", async () => {
    await expect(narrate(frames, "x", reply(429, { detail: "The daily agent budget" }) as unknown as typeof fetch)).rejects.toThrow(/budget/);
    await expect(narrate(frames, "x", reply(500, { detail: "GROQ_API_KEY is not set." }) as unknown as typeof fetch)).rejects.toThrow(/GROQ_API_KEY/);
    await expect(narrate(frames, "x", (async () => { throw new TypeError("offline"); }) as unknown as typeof fetch)).rejects.toThrow(/API is running/);
    await expect(narrate(frames, "x", reply(200, { captions: [cap("zzz")] }) as unknown as typeof fetch)).rejects.toThrow(/usable/);
    await expect(narrate(frames, "x", reply(200, "not json") as unknown as typeof fetch)).rejects.toThrow();
  });

  it("has a message for every status", () => {
    for (const s of [null, 413, 429, 502, 500]) expect(narrateErrorMessage(s, "")).toMatch(/\S/);
  });
});

describe("replays cache in the Y.Doc", () => {
  const entry = (frameCount: number, text = "A"): ReplayEntry => ({ captions: [cap("a", text)], generatedAt: 1, frameCount });

  it("writes when there is no entry", () => {
    const map = new Y.Doc().getMap<unknown>("replays");
    expect(saveReplay(map, "d1", entry(3))).toEqual(entry(3));
    expect(readReplays(map).d1).toEqual(entry(3));
  });

  it("keeps the first entry when a second response arrives for the same frame count", () => {
    const map = new Y.Doc().getMap<unknown>("replays");
    saveReplay(map, "d1", entry(3, "first"));
    const shown = saveReplay(map, "d1", entry(3, "second"));
    expect(shown.captions[0].text).toBe("first");
    expect(readReplays(map).d1.captions[0].text).toBe("first");
  });

  it("replaces a stale entry (different frame count) and any entry when forced", () => {
    const map = new Y.Doc().getMap<unknown>("replays");
    saveReplay(map, "d1", entry(3, "old"));
    expect(saveReplay(map, "d1", entry(4, "new")).captions[0].text).toBe("new");
    expect(saveReplay(map, "d1", entry(4, "forced"), true).captions[0].text).toBe("forced");
  });

  it("overwrites a malformed entry and skips it on read", () => {
    const map = new Y.Doc().getMap<unknown>("replays");
    map.set("d1", { captions: "nope" });
    expect(readReplays(map)).toEqual({});
    expect(saveReplay(map, "d1", entry(2)).frameCount).toBe(2);
  });

  it("converges to one version when two peers write", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    saveReplay(a.getMap<unknown>("replays"), "d1", entry(3, "from a"), true);
    saveReplay(b.getMap<unknown>("replays"), "d1", entry(3, "from b"), true);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(readReplays(a.getMap<unknown>("replays"))).toEqual(readReplays(b.getMap<unknown>("replays")));
  });
});
