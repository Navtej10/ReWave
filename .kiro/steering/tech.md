# Tech stack

- Web: TypeScript (strict), React 18, Vite. Copy-paste-ready TS, no `any`.
- Live sync: Yjs CRDT over Hocuspocus (apps/collab). NOT operational transformation.
- Agents API: FastAPI (apps/api) calling the Anthropic API; model name comes from ANTHROPIC_MODEL.
- Tests: Vitest; property-based tests with fast-check for sync/merge logic.

## Conventions
- Blips are Y.Map entries in a Y.Array named "blips"; text lives in a Y.Text.
- UI reads plain BlipView objects from useWave(); never touch Yjs types in components.
- Prefer small diffs. Do not reformat files you are not changing.
- Run `npm run typecheck && npm test` before calling a task done.
