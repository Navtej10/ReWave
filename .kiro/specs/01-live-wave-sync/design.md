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
- `apps/web/src/wave/applyDiff.ts`: turns a textarea value into a minimal Y.Text edit (prefix/suffix diff) so concurrent edits merge.

## Correctness properties (property-based tests, fast-check)
- P1: `applyDiff(text, target)` always yields exactly `target`.
- P2: Two replicas that each apply an arbitrary edit and then exchange updates end up identical.

## Risks
- In-memory persistence: waves vanish on server restart (task 5 adds persistence).
