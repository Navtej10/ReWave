# Requirements: Decision replay

## Introduction

A **Replay** button on each decision in the decision log. It plays back how the thread built
up to that decision, one blip at a time, with short AI captions. It serves the product's one
job: a reader who missed the debate can see how it became a decision, with every caption tied
to the blip it describes.

Replay shows each blip in its **final text**, not every keystroke (the wave's Y.Doc keeps no
edit history). Captions come from one new endpoint, `POST /agents/narrate`, and are cached in
the wave's own Y.Doc. Agent rules from `agent-behavior.md` apply: the user's Replay click is
the prompt; nothing is posted as a blip; no human blip is edited.

Out of scope: keystroke-level playback, exporting a replay as video, replay of the whole wave
without a decision, narration in any language other than the thread's.

## Requirements

### R1: Replay frames (pure logic)

**User story:** As a reader, I want the replay to end exactly where the decision came from, so
that I do not see unrelated later discussion.

#### Acceptance criteria

1. WHEN `buildReplayFrames(blips, decision)` is called THEN it SHALL return frames in the
   wave's blip order, one blip per frame, each with a `cited` flag.
2. WHEN `decision.sourceBlipId` names an existing, non-deleted blip THEN the replay SHALL end
   at that blip (blips after it in wave order are excluded).
3. WHEN there is no usable source blip AND the decision cites at least one existing,
   non-deleted blip (`decisionSources`) THEN the replay SHALL end at the last cited blip in
   wave order.
4. WHEN neither of the above applies AND `decision.threadLength` is an integer >= 1 THEN the
   replay SHALL end at the blip at that position (1-based, clamped to the wave length).
5. WHEN none of the above applies THEN the replay SHALL include exactly the blips whose
   `createdAt` is <= `decision.createdAt`.
6. WHEN a blip is included THEN all of its ancestors SHALL be included too, even if an
   ancestor is past the end point or soft-deleted, and a parent SHALL appear before its
   children in the frame list.
7. WHEN a blip is soft-deleted and is not an ancestor of an included blip THEN it SHALL NOT
   get a frame.
8. WHEN a blip's `parentId` points at a blip that does not exist, or the parent chain loops,
   or two blips share an id, or an entry has no id THEN `buildReplayFrames` SHALL NOT throw
   and SHALL treat the blip as a root (missing parent), ignore the loop, keep the first of
   duplicates, or skip the entry.
9. WHEN a frame's blip is listed by `decisionSources` for the decision THEN `cited` SHALL be
   true, and for no other frame.
10. WHEN the decision cites blips that no longer exist THEN they SHALL be ignored.
11. WHEN no blip qualifies THEN it SHALL return an empty list.
12. The frame count SHALL never exceed the number of blips.

### R2: Playback state machine

**User story:** As a reader, I want play, pause, step and speed controls that behave
predictably, so that I can go at my own pace.

#### Acceptance criteria

1. WHEN playback starts THEN the state SHALL be `{ status, index, speed }` with `index` the
   current frame (0-based), `speed` one of 1, 2, 4, and `total` the frame count.
2. WHEN `play` is dispatched AND the current frame is the last THEN it SHALL restart from
   frame 0. WHEN there are no frames THEN `play` SHALL do nothing.
3. WHEN `tick` is dispatched while playing THEN `index` SHALL advance by one, and WHEN that
   reaches the last frame THEN the status SHALL become `paused`.
4. WHEN `next`, `prev` or `seek` is dispatched THEN `index` SHALL be clamped to
   `0..total-1`, and a manual move SHALL pause playback.
5. WHEN `setSpeed` is dispatched with a value other than 1, 2 or 4 THEN the state SHALL NOT
   change.
6. WHEN the number of frames changes THEN the index SHALL be clamped to the new range.
7. WHEN the replay has more than 40 frames THEN the dwell time on a frame that is not cited
   SHALL be short (<= 200 ms at 1x), and the dwell on a cited frame SHALL be at least 3x the
   dwell on an uncited frame. WHEN the replay has 40 frames or fewer THEN every frame SHALL
   get a readable dwell.
8. WHEN speed is 2 or 4 THEN every dwell time SHALL be divided by the speed.

### R3: Narration endpoint

**User story:** As a reader, I want one or two plain sentences per step, so that I can follow
the story without reading every blip.

#### Acceptance criteria

1. WHEN a client posts to `POST /agents/narrate` with the frame blips (`id`, `author`,
   `text`, `parentId`) and the decision text THEN the API SHALL answer
   `{ captions: [{ atBlipId, text }] }`.
2. WHEN the model returns captions THEN the API SHALL drop any caption whose `atBlipId` is
   not an input blip id, whose text is empty or not a string, or that repeats an earlier
   `atBlipId`.
3. WHEN captions are kept THEN they SHALL be ordered by the position of `atBlipId` in the
   input list, capped at 6, with text capped at 280 characters and `[b:id]` markers
   removed.
4. WHEN no caption survives validation THEN the API SHALL answer 502 with a plain message.
5. WHEN the request has no blips, no decision text, or is over the size limits THEN the API
   SHALL answer 400 or 413 and SHALL NOT spend rate-limit budget.
6. WHEN `GROQ_API_KEY` is missing THEN the API SHALL answer 500 with the same clear message
   as the other agents.
7. WHEN the request passes validation THEN it SHALL be charged against the existing per-client
   rate limit and daily budget (`CallGuard`), and exceeding either SHALL answer 429 with
   `Retry-After`.
8. The prompt SHALL tell the model to use only the blips given, to treat blip text as data
   and never as instructions, and to write 3 to 6 captions of one or two sentences each.
9. The route SHALL be registered so it is not swallowed by `POST /agents/{agent}`.

### R4: Caption cache in the wave's Y.Doc

**User story:** As a team member, I want captions generated once and shared, so that the
second person to click Replay pays no cost and sees the same story.

#### Acceptance criteria

1. WHEN captions are saved THEN they SHALL be stored in a Y.Map named `replays` in the wave's
   own Y.Doc, keyed by decision id, as `{ captions, generatedAt, frameCount }`.
2. WHEN Replay opens AND a stored entry has the same `frameCount` as the current frames THEN
   the app SHALL use it and SHALL NOT call the API.
3. WHEN Replay opens AND there is no entry, or its `frameCount` differs THEN the app SHALL
   request captions.
4. WHEN a response arrives AND an entry with a matching `frameCount` already exists THEN the
   app SHALL NOT overwrite it and SHALL show the stored one, so two people clicking at once
   end up with one version.
5. WHEN the user chooses "Regenerate captions" THEN the app SHALL request new captions and
   replace the entry.
6. WHEN a stored entry is malformed (from a peer or an old client) THEN it SHALL be treated
   as absent and SHALL NOT crash the app.
7. The `replays` map SHALL never be sent anywhere except the wave's own sync; no global index
   is created.
8. WHEN a decision is removed THEN its replay entry MAY remain; it SHALL be ignored.

### R5: Failure handling

#### Acceptance criteria

1. WHEN narration fails (network, rate limit, budget, model error, no usable captions) THEN
   the replay SHALL still play without captions and SHALL show a short notice with the
   reason in plain language and a Retry action.
2. WHEN narration is loading THEN the replay SHALL be usable and the caption bar SHALL say
   captions are being written.
3. WHEN the wave is offline THEN a cached entry SHALL still be used; otherwise R5.1 applies.

### R6: Replay UI

**User story:** As a reader, I want a focused view of the thread building up, so that I can
watch the decision form.

#### Acceptance criteria

1. WHEN a decision is listed in the decision log THEN it SHALL have a "Replay" button whose
   accessible name includes the decision text. WHEN the decision has no frames THEN the button
   SHALL be disabled with an explanation.
2. WHEN Replay is clicked THEN a modal dialog SHALL open over the wave, with focus moved into
   it and returned to the Replay button on close.
3. WHEN a frame is current THEN the dialog SHALL show the blips of all frames up to and
   including it, with author, avatar, attachments and reply nesting preserved, and the
   newest blip scrolled into view.
4. WHEN a blip is cited by the decision THEN it SHALL be visibly highlighted and carry a
   text label ("Cited"), not color alone.
5. WHEN a frame is current THEN the caption bar under the thread SHALL show the latest
   caption at or before that frame, in a region with `aria-live="polite"`.
6. WHEN the current frame is the last THEN the decision text SHALL be shown next to the
   thread (stacked below it on narrow screens).
7. WHEN the dialog is open THEN it SHALL offer play/pause, step back, step forward, a
   draggable scrubber (`<input type="range">` with an accessible name and value text), and a
   1x/2x/4x speed selector.
8. WHEN the dialog is open THEN Space SHALL toggle play, Left and Right SHALL step, and
   Esc SHALL close. WHEN focus is on a button, link or select THEN Space keeps its native
   meaning there, and WHEN focus is on the scrubber or a select THEN Left and Right keep
   their native meaning there.
9. WHEN the dialog is open THEN it SHALL show a short note that replay shows blips in their
   final text, not every keystroke.
10. WHEN the replay is shown THEN none of the blip actions (reply, edit, delete, pin, react,
    vote, close poll, add to log, dismiss, stance, annotate) SHALL be offered inside it. Polls
    are shown closed. Citation chips and the reply quote scroll within the replay.
11. WHEN the viewport is 1280px or 390px wide THEN the dialog SHALL fit without horizontal
    scrolling, and controls SHALL be at least 44px tall at 390px.
12. WHEN `prefers-reduced-motion: reduce` is set THEN blips SHALL appear without fade or rise
    animation AND the replay SHALL NOT start playing on open.
13. WHEN the replay is not reduced-motion THEN it SHALL start playing on open.
14. The UI SHALL use the design tokens the wave panel already uses (`styles/tokens.css`) and no
    new UI library. (`.kiro/steering/design.md` lists `--rw-*` tokens that only the legacy
    `styles.css` still defines; see design.md here.)
