# Tech stack

- Web: TypeScript (strict), React 18, Vite. Copy-paste-ready TS, no `any`.
- Live sync: Yjs CRDT over Hocuspocus (apps/collab). NOT operational transformation.
- Agents API: FastAPI (apps/api) calling the Anthropic API; model name comes from ANTHROPIC_MODEL.
- Tests: Vitest; property-based tests with fast-check for sync/merge logic.

## Conventions
- Blips are Y.Map entries in a Y.Array named "blips"; text lives in a Y.Text.
- Each wave's own Y.Doc also holds a "meta" Y.Map (title, createdAt). There is NO shared
  "index" document and NO server-side list of waves or users.
- Waves are private: a user's list of joined waves lives only in their browser
  (localStorage key `rewave:mywaves`), never synced. A wave id is an unguessable capability
  (>=128 random bits, url-safe base64) and is the only thing a share link carries.
- One rule, `isValidWaveId` in src/wave/waveId.ts, defines a legal wave id; the collab
  server mirrors it (with a comment pointing back) to refuse any non-wave document name.
- UI reads plain BlipView objects from useWave(); never touch Yjs types in components.
- Prefer small diffs. Do not reformat files you are not changing.
- Run `npm run typecheck && npm test` before calling a task done.
