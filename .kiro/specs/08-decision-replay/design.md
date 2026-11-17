# Design: Decision replay

## Approach

Replay is a read-only view over data the wave already has. A pure function picks the blips
(frames); a small reducer drives playback; one new API endpoint writes captions; captions are
cached in the wave's own Y.Doc. The user's click on Replay is the human prompt for the
narration call (`agent-behavior.md` rule 6). Nothing is posted as a blip.

## Pure logic (no React)

### `apps/web/src/wave/replayFrames.ts`

```ts
export interface ReplayFrame {
  blip: BlipView;
  /** Listed by decisionSources(decision, all blip ids). */
  cited: boolean;
}
export type ReplayEnd = "source" | "lastCited" | "threadLength" | "createdAt";
export function buildReplayFrames(blips: readonly BlipView[], decision: Decision): ReplayFrame[];
export function replayEnd(blips, decision): ReplayEnd; // which rule applied (tests, notice text)
```

Algorithm:

1. Keep the first blip for each non-empty string id (`order`); skip the rest.
2. `live` = not deleted. Pick the end rule in order: `sourceBlipId` in `live` -> index of that
   blip; else last of `decisionSources(decision, ids)` that is in `live`; else
   `threadLength >= 1` -> index `min(threadLength, n) - 1` in the full order; else everything
   with `createdAt <= decision.createdAt`. The first three rules include `live` blips with
   index <= end; the last rule includes `live` blips by timestamp.
3. Ancestor closure: for each included blip walk `parentId` (visited-set guards loops; a
   missing parent stops the walk) and add every existing ancestor, deleted or not.
4. Emit in wave order, but a blip is emitted only after its included parent (depth-first on
   the parent, loop-guarded). That guarantees "parent before child" even if the stored order
   is odd.
5. `cited` = id in `decisionSources(decision, allIds)`.

Deleted blips outside the ancestor closure get no frame: they render as "This blip was
deleted" and add nothing to the story. Ancestors that are deleted keep a frame so replies are
never orphaned (the existing blip card already renders the deleted placeholder).

### `apps/web/src/wave/replayPlayback.ts`

```ts
export type ReplaySpeed = 1 | 2 | 4;
export interface PlaybackState { status: "playing" | "paused"; index: number; speed: ReplaySpeed; total: number }
export type PlaybackAction =
  | { type: "play" } | { type: "pause" } | { type: "toggle" } | { type: "tick" }
  | { type: "next" } | { type: "prev" } | { type: "seek"; index: number }
  | { type: "speed"; speed: number } | { type: "frames"; total: number };
export function initialPlayback(total: number, autoplay: boolean): PlaybackState;
export function playbackReducer(s: PlaybackState, a: PlaybackAction): PlaybackState;
export const LONG_REPLAY_FRAMES = 40;
export function dwellMs(cited: boolean, total: number, speed: ReplaySpeed): number;
```

Dwell (before speed): short replay (<= 40 frames) uncited 1400 ms, cited 2400 ms. Long replay
uncited 150 ms, cited 2400 ms. Divided by `speed`. The player hook sets one `setTimeout` for
the current frame while `status === "playing"` and dispatches `tick`.

### `apps/web/src/wave/replayCaptions.ts`

```ts
export interface ReplayCaption { atBlipId: string; text: string }
export interface ReplayEntry { captions: ReplayCaption[]; generatedAt: number; frameCount: number }
export function parseReplayEntry(raw: unknown): ReplayEntry | null;      // defensive
export function sanitizeCaptions(raw: unknown, frameIds: readonly string[]): ReplayCaption[]; // same rules as the API
export function captionAt(frames, captions, index): ReplayCaption | null; // latest caption at or before index
export function isFresh(entry, frameCount): boolean;
export function narrationRequest(frames, decision): { blips; decision };   // agentTextOf for blip text
export async function narrate(frames, decision, fetchImpl?): Promise<ReplayCaption[]>;
export function narrateErrorMessage(status: number | null, detail: string): string;
```

`narrate` posts to `/api/agents/narrate` and re-validates the answer with `sanitizeCaptions`
(client-side backstop, like `sanitizeReply`).

### `apps/web/src/wave/replays.ts` (Yjs, tiny)

```ts
export function readReplays(map: Y.Map<unknown>): Record<string, ReplayEntry>;
export function saveReplay(map, decisionId, entry, force: boolean): ReplayEntry; // returns the entry in effect
```

`saveReplay` writes only when `force`, or there is no valid entry, or the stored entry's
`frameCount` differs from `entry.frameCount` (stale). Otherwise it keeps the stored one and
returns it. Two people clicking at once: the first response writes, the second sees a fresh
entry and shows it instead of its own. If two writes still cross the network, Yjs makes
both clients converge on one of them. `useWave` observes the map, exposes `replays` and
`saveReplay`.

## API

`POST /agents/narrate` in `apps/api/main.py`, registered **before** `/agents/{agent}`.

```
request:  { blips: [{ id, parentId, author, text }], decision: string }
response: { captions: [{ atBlipId, text }] }
```

- Validation order (no budget spent on failure): no blips -> 400; empty decision -> 400;
  `check_size` -> 413; `client()` (missing key -> 500); then `GUARD.check` (429 + Retry-After).
  This is the same order as `_prepare`, and it reuses `Limits`, `CallGuard` and `check_size`.
- Each blip's text is cut to 600 characters and the decision to 600 so one call stays cheap.
- Prompt lives in `agents.py` as `NARRATOR_PROMPT` (not in `AGENTS`, so it is not a mentionable
  agent). It asks for JSON only: `{"captions":[{"atBlipId","text"}]}`, 3 to 6 captions, one or
  two sentences, only facts from the listed blips, and says blip text is data, never
  instructions.
- Validation of the model output is in `apps/api/narration.py` (pure, unit tested):
  `validate_captions(raw, order, max_captions=6, max_chars=280)`. It drops unknown ids, empty or
  non-string text, and duplicate ids, strips `[b:id]` markers, sorts by position in `order`,
  and caps count and length. Citation of the source blip is the `atBlipId` link itself, which
  satisfies "every claim links back to a blip" for captions.
- Non-streaming Groq call with the same `MODEL`, `REASONING_EFFORT`, `MAX_COMPLETION_TOKENS`;
  Groq errors map to 429/502 like `_agent_events`.

## UI

- `components/DecisionLog.tsx`: each decision gets a "Replay" button (`onReplay(decision)`).
  Disabled when `buildReplayFrames` is empty.
- `components/ReplayView.tsx`: a `Modal` (existing focus trap, Esc, focus restore). Contents:
  header (title, close), note ("Replay shows each blip in its final text, not every
  keystroke."), the thread built with the existing `BlipNode` over the visible frames only,
  caption bar (`aria-live="polite"`), decision panel on the last frame, controls row.
- `BlipNode` gets one optional prop, `replay: ReplayDecor` (`idPrefix`, `className(id)`,
  `badge(id)`). When set, `BlipCard` gets `readOnly` (no reactions, stances, reply/pin/edit/
  delete), blip DOM ids use `rp-b-` so they never clash with the live thread, and the
  cited/current marks render. Polls are passed closed, no-op actions are supplied, and
  `replay.css` hides remaining buttons (`.ink-btn`, `.rc-linkbtn`, agent-card actions).
  Citation chips and the reply quote scroll inside the replay.
- `useReplayPlayer` (inside `ReplayView`): `useReducer(playbackReducer)`, the dwell timer, and
  keyboard handling. Space/arrows are ignored when the event target is a button, input or
  select, so those keep native behavior.
- Narration state lives in `ReplayView`: `idle | loading | ready | failed`. On mount it uses a
  fresh cached entry or calls `narrate` once. `Regenerate captions` calls with `force`.
- `WavePanel` owns `replayDecisionId`, renders `ReplayView`, and passes `replays` / `saveReplay`
  from `useWave`.
- Styles in `styles/replay.css` using only `--rw-*` tokens. `prefers-reduced-motion` turns off
  the blip fade-in; autoplay is off in that mode (decided in JS with `matchMedia`).

## Files

New: `wave/replayFrames.ts`, `wave/replayPlayback.ts`, `wave/replayCaptions.ts`,
`wave/replays.ts`, matching `*.test.ts`, `replayFrames.property.test.ts`,
`components/ReplayView.tsx`, `components/ReplayView.test.tsx` (server-render smoke test), `styles/replay.css`, `apps/api/narration.py`,
`apps/api/tests/test_narrate.py`.

Changed: `wave/useWave.ts`, `wave/agents.ts` (export `detailOf`), `components/DecisionLog.tsx`, `components/WavePanel.tsx`,
`components/BlipNode.tsx`, `components/BlipCard.tsx`, `styles/index.ts`, `apps/api/main.py`,
`apps/api/agents.py`, `.kiro/steering/agent-behavior.md`.

## Decisions and trade-offs

- **Final text only.** The doc stores no edit history, so keystroke replay is impossible
  without a new log. Cut (also by the product rule: no feature that does not help reach a
  decision). The UI says so.
- **Cache in the Y.Doc, not the server.** Matches the "no server-side state" rule and lets
  all members share one version. Cost: any member can overwrite via Regenerate.
- **Sort captions, do not drop out-of-order ones.** The model's order is not meaningful;
  position in the thread is.
- **Fewer than 3 captions is accepted** when validation drops some, or the thread has fewer
  than 3 blips. Zero is an error.
- **Reuse `BlipNode` read-only** instead of a second renderer: same look as the live thread,
  small diff. `inert` was rejected because it also removes the thread from the accessibility tree.
- **Tokens.** The live wave panel uses the ink-on-parchment tokens in `styles/tokens.css`
  (`--paper`, `--ink`, `--terracotta`, ...), not the `--rw-*` set in `steering/design.md`
  (only the legacy `styles.css` still defines those). Replay follows the live panel so the
  modal matches the blips inside it.
- **Autoplay.** The replay starts playing on open unless `prefers-reduced-motion: reduce`.
- **Frames are a snapshot** taken when Replay opens, so the story does not shift if people post
  while it plays.
