export type ReplaySpeed = 1 | 2 | 4;
export const REPLAY_SPEEDS: readonly ReplaySpeed[] = [1, 2, 4];

/** Replays longer than this skip quickly over blips the decision does not cite. */
export const LONG_REPLAY_FRAMES = 40;

const DWELL_CITED_MS = 2400;
const DWELL_UNCITED_MS = 1400;
const DWELL_SKIP_MS = 150;

export interface PlaybackState {
  status: "playing" | "paused";
  /** Current frame, 0-based. Frames 0..index are on screen. */
  index: number;
  speed: ReplaySpeed;
  total: number;
}

export type PlaybackAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "tick" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "seek"; index: number }
  | { type: "speed"; speed: number }
  | { type: "frames"; total: number };

export function initialPlayback(total: number, autoplay: boolean): PlaybackState {
  const safe = Math.max(0, Math.floor(total) || 0);
  return { status: autoplay && safe > 1 ? "playing" : "paused", index: 0, speed: 1, total: safe };
}

const clamp = (index: number, total: number) => (total <= 0 ? 0 : Math.min(Math.max(0, Math.floor(index) || 0), total - 1));

export function isReplaySpeed(value: number): value is ReplaySpeed {
  return value === 1 || value === 2 || value === 4;
}

export function playbackReducer(s: PlaybackState, a: PlaybackAction): PlaybackState {
  const last = s.total - 1;
  switch (a.type) {
    case "play":
      if (s.total <= 0) return s;
      // Playing from the end starts over.
      return { ...s, status: "playing", index: s.index >= last ? 0 : s.index };
    case "pause":
      return s.status === "paused" ? s : { ...s, status: "paused" };
    case "toggle":
      return playbackReducer(s, { type: s.status === "playing" ? "pause" : "play" });
    case "tick": {
      if (s.status !== "playing") return s;
      const index = clamp(s.index + 1, s.total);
      return { ...s, index, status: index >= last ? "paused" : "playing" };
    }
    case "next":
      return { ...s, status: "paused", index: clamp(s.index + 1, s.total) };
    case "prev":
      return { ...s, status: "paused", index: clamp(s.index - 1, s.total) };
    case "seek":
      return { ...s, status: "paused", index: clamp(a.index, s.total) };
    case "speed":
      return isReplaySpeed(a.speed) ? { ...s, speed: a.speed } : s;
    case "frames": {
      const total = Math.max(0, Math.floor(a.total) || 0);
      const index = clamp(s.index, total);
      return { ...s, total, index, status: total <= 1 || index >= total - 1 ? "paused" : s.status };
    }
  }
}

/**
 * How long to stay on a frame before moving to the next. Cited blips get time to read; in a long
 * replay everything else flies by. Faster speeds divide the time.
 */
export function dwellMs(cited: boolean, total: number, speed: ReplaySpeed): number {
  const base = cited ? DWELL_CITED_MS : total > LONG_REPLAY_FRAMES ? DWELL_SKIP_MS : DWELL_UNCITED_MS;
  return Math.round(base / speed);
}
