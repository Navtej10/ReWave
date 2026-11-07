# Design: Live wave sync

## Approach

Yjs CRDT documents synced through Hocuspocus, one document per wave id. Wave's original operational
transformation was its hardest engineering part; a CRDT gives convergence without a central transform server.

## Data model

- `Y.Array<Y.Map>` named `blips`.
- Each blip map: `id`, `parentId | null`, `author`, `kind` (human | agent), `createdAt`, `sources: string[]`, `text: Y.Text`.

## Components

- `apps/collab/src/index.ts`: Hocuspocus server.
- `apps/web/src/wave/useWave.ts`: connects, exposes `blips`, `peers`, `status`, `addBlip`, `editBlip`.
- `apps/web/src/wave/applyDiff.ts`: turns a textarea value into a minimal Y.Text edit (prefix/suffix diff) so edits to a blip merge cleanly.
- UI for the transient presence signals lives in `apps/web/src/components/`: `TypingBubble.tsx` (R4 typing indicator) and `EditLockLabel.tsx` (R5 edit lock). These are prop-only presentational components fed by `useWave()`; the awareness logic itself stays in the wave layer.

## Ephemeral presence (R4 typing indicator, R5 edit locks)

Typing indicators and edit locks are transient and MUST NOT be written to the Y.Doc. They travel over
the Yjs **awareness** channel keyed by `clientID`, so they vanish automatically when a client leaves.

- Typing: a client advertises the parent it is composing under (or top-level); throttled, cleared on
  send / empty / blur / ~4s idle / disconnect.
- Edit lock: a client advertises the blip id it is editing. At most one holder; ties resolve to the
  lowest `clientID`. Released on blur / ~10s idle / disconnect. A client that loses the tie treats the
  blip as read-only without discarding its local text.

## Correctness properties (property-based tests, fast-check)

- P1: `applyDiff(text, target)` always yields exactly `target`.
- P2: Two replicas that each apply an arbitrary edit and then exchange updates end up identical.

## Risks

- In-memory persistence: waves vanish on server restart (task 5 adds persistence).
