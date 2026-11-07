# Tasks: Multiple waves

- [x] 1. Pure index logic `wave/waveIndex.ts`: `WaveMeta`/`WaveSummary` types,
      `applyBlipToMeta`, `snippetOf`, `deriveTitle`, `sortWaves`, `filterWaves`,
      `unreadCount` (R1, R4, R5).
- [x] 2. Unit tests `wave/waveIndex.test.ts` for index update, sorting, filtering, title
      fallback, and unread calculation (R1.3, R4.1/4.2/4.6, R5.1/5.5).
- [x] 3. Property test `wave/waveIndex.property.test.ts` (fast-check): unread never
      negative; advancing last-seen on own blips keeps unread at 0 (R5.3, R5.5).
- [x] 4. Shared websocket: `useWave` accepts an optional `websocketProvider` and
      `onBlipAdded` callback; builds the provider on the shared socket when given (R2, R8.4).
- [x] 5. `wave/useWaveIndex.ts`: index document + shared socket, awareness presence,
      `createWave`, `renameWave`, `recordBlip`, `markSeenMine`, `unreadOf`, `markRead`
      (R1, R2, R6, R7).
- [x] 6. `components/WaveListItem.tsx` + `components/WaveList.tsx`: rows, search box, New
      wave button, empty state, selection highlight, keyboard nav, presence dot, unread
      badge (R4, R6, R9.4).
- [x] 7. `components/WaveTitle.tsx`: editable wave title wired to `renameWave` (R8.2).
- [x] 8. `App.tsx`: two-panel inbox shell, hash routing with Back support, selection
      wiring, mobile Back button, right-panel wave composition reusing existing components
      (R3, R8, R9). (Extracted the open wave into `components/WavePanel.tsx`.)
- [x] 9. `styles.css`: `.rw-inbox` grid, list panel, rows, unread badge, presence dot,
      editable title, responsive single-column + Back at < 900px (R9).
- [x] 10. Run `npm run typecheck && npm test` in `apps/web`; fix failures. (38 tests pass.)
