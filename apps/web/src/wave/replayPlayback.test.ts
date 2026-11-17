import { describe, expect, it } from "vitest";
import { dwellMs, initialPlayback, LONG_REPLAY_FRAMES, playbackReducer, type PlaybackAction, type PlaybackState } from "./replayPlayback";

const run = (s: PlaybackState, ...actions: PlaybackAction[]) => actions.reduce(playbackReducer, s);

describe("playbackReducer", () => {
  it("starts paused at frame 0, or playing with autoplay", () => {
    expect(initialPlayback(5, false)).toEqual({ status: "paused", index: 0, speed: 1, total: 5 });
    expect(initialPlayback(5, true).status).toBe("playing");
  });

  it("does not autoplay a replay with nothing to step through", () => {
    expect(initialPlayback(0, true).status).toBe("paused");
    expect(initialPlayback(1, true).status).toBe("paused");
  });

  it("ticks forward while playing and pauses on the last frame", () => {
    let s = initialPlayback(3, true);
    s = run(s, { type: "tick" });
    expect(s).toMatchObject({ index: 1, status: "playing" });
    s = run(s, { type: "tick" });
    expect(s).toMatchObject({ index: 2, status: "paused" });
    expect(run(s, { type: "tick" }).index).toBe(2);
  });

  it("ignores ticks while paused", () => {
    const s = initialPlayback(3, false);
    expect(run(s, { type: "tick" })).toBe(s);
  });

  it("restarts from the beginning when played at the end", () => {
    const end = run(initialPlayback(3, false), { type: "seek", index: 2 });
    expect(run(end, { type: "play" })).toMatchObject({ index: 0, status: "playing" });
  });

  it("play does nothing without frames", () => {
    const s = initialPlayback(0, false);
    expect(run(s, { type: "play" })).toBe(s);
  });

  it("toggles between playing and paused", () => {
    const s = initialPlayback(4, false);
    expect(run(s, { type: "toggle" }).status).toBe("playing");
    expect(run(s, { type: "toggle" }, { type: "toggle" }).status).toBe("paused");
  });

  it("steps and clamps, and a manual step pauses", () => {
    let s = initialPlayback(3, true);
    s = run(s, { type: "next" });
    expect(s).toMatchObject({ index: 1, status: "paused" });
    s = run(s, { type: "next" }, { type: "next" }, { type: "next" });
    expect(s.index).toBe(2);
    s = run(s, { type: "prev" }, { type: "prev" }, { type: "prev" });
    expect(s.index).toBe(0);
  });

  it("seeks within range and pauses", () => {
    const s = initialPlayback(10, true);
    expect(run(s, { type: "seek", index: 7 })).toMatchObject({ index: 7, status: "paused" });
    expect(run(s, { type: "seek", index: 99 }).index).toBe(9);
    expect(run(s, { type: "seek", index: -4 }).index).toBe(0);
    expect(run(s, { type: "seek", index: Number.NaN }).index).toBe(0);
  });

  it("accepts only 1x, 2x and 4x", () => {
    const s = initialPlayback(3, false);
    expect(run(s, { type: "speed", speed: 4 }).speed).toBe(4);
    expect(run(s, { type: "speed", speed: 3 })).toBe(s);
    expect(run(s, { type: "speed", speed: 0 })).toBe(s);
  });

  it("keeps speed across seeks and plays", () => {
    const s = run(initialPlayback(5, false), { type: "speed", speed: 2 }, { type: "play" }, { type: "seek", index: 3 });
    expect(s.speed).toBe(2);
  });

  it("clamps the index when the frame count changes", () => {
    const s = run(initialPlayback(10, false), { type: "seek", index: 8 }, { type: "frames", total: 4 });
    expect(s).toMatchObject({ total: 4, index: 3, status: "paused" });
    expect(run(s, { type: "frames", total: 0 })).toMatchObject({ total: 0, index: 0 });
  });
});

describe("dwellMs", () => {
  it("gives every frame a readable dwell in a short replay", () => {
    expect(dwellMs(false, LONG_REPLAY_FRAMES, 1)).toBeGreaterThanOrEqual(1000);
    expect(dwellMs(true, LONG_REPLAY_FRAMES, 1)).toBeGreaterThan(dwellMs(false, LONG_REPLAY_FRAMES, 1));
  });

  it("skips quickly over uncited frames in a long replay and lingers on cited ones", () => {
    const long = LONG_REPLAY_FRAMES + 1;
    expect(dwellMs(false, long, 1)).toBeLessThanOrEqual(200);
    expect(dwellMs(true, long, 1)).toBeGreaterThanOrEqual(3 * dwellMs(false, long, 1));
  });

  it("divides by speed", () => {
    expect(dwellMs(true, 5, 2)).toBe(dwellMs(true, 5, 1) / 2);
    expect(dwellMs(true, 5, 4)).toBe(dwellMs(true, 5, 1) / 4);
  });
});
