# Tasks: Multiple waves (private, membership-based)

> The items below marked `[x]` were completed against the earlier shared-`index`
> draft of this spec. The privacy rewrite (no shared index; per-user membership list;
> per-wave `meta`) changes the data model, so the follow-up items re-point that work at
> the new model. Do not change code outside what a task names.

- [x] 1. Pure logic `wave/waveIndex.ts`: `WaveMeta`/`WaveSummary` types, `applyBlipToMeta`,
      `snippetOf`, `deriveTitle`, `sortWaves`, `filterWaves`, `unreadCount` (R5, R6).
- [x] 2. Unit tests `wave/waveIndex.test.ts` for summary update, sorting, filtering, title
      fallback, and unread calculation (R5.1/5.2/5.6, R6.1/6.5).
- [x] 3. Property test `wave/waveIndex.property.test.ts` (fast-check): unread never
      negative; advancing last-seen on own blips keeps unread at 0 (R6.3, R6.5).
- [x] 4. Shared websocket: `useWave` accepts an optional `getConn` (reuse the inbox's
      background connection for the open wave, avoiding a second provider on the shared
      socket), a fallback `websocketProvider` for tests/single-wave use, and an `onBlipAdded`
      callback (R3, R9.5).
- [x] 6. `components/WaveListItem.tsx` + `components/WaveList.tsx`: rows, search box, New
      wave button, empty state, selection highlight, keyboard nav, presence dot, unread
      badge (R5, R7, R10.4).
- [x] 7. `components/WaveTitle.tsx`: editable wave title (R9.2).
- [x] 8. `App.tsx`: two-panel inbox shell, hash routing with Back support, selection
      wiring, mobile Back button, right-panel wave composition reusing existing components
      (R4, R9, R10). (Extracted the open wave into `components/WavePanel.tsx`.)
- [x] 9. `styles.css`: `.rw-inbox` grid, list panel, rows, unread badge, presence dot,
      editable title, responsive single-column + Back at < 900px (R10).

## Follow-ups for the privacy rewrite (shared index removed)

- [ ] 11. Remove the shared `index` document. Add `wave/membership.ts`: parse/serialize the
      private `rewave:mywaves` list of `{ id, joinedAt, lastSeenCount }`; tolerate
      missing/empty/malformed input; idempotent `addWave`/`joinWave`, `leaveWave`,
      `setLastSeen`. Unit-test the parse/idempotency/clamp paths (R1, R6.4).
- [ ] 12. Per-wave `meta`: in `useWave`, create/read a `Y.Map` named `meta`
      (`title`, `createdAt`); set `createdAt`/`title` on create; `renameWave` edits
      `meta.title`; `WaveTitle` binds to `meta.title` (R2, R9.2).
- [ ] 13. Rework `wave/useWaveIndex.ts`: drop the index doc and its awareness. Drive the
      inbox from the membership list; open one lightweight background provider per joined
      wave on the shared socket (blips + meta for the row summary, that wave's awareness for
      presence; no typing/edit-lock publishing); tear down providers on leave (R2, R3, R7).
- [ ] 14. Move `lastSeenCount` into the membership record (was `rewave:seen:<waveId>`);
      `markRead`/`markSeenMine`/`unreadOf` read and write `rewave:mywaves` (R6).
- [ ] 15. Hash routing: when `#<waveId>` names a non-member wave, defer to the Join flow in
      spec `07-share-links` instead of opening directly (R4.2). Open-wave header gains
      "Copy invite link" + "Leave wave" (behavior in spec `07-share-links`, R9.4).
- [ ] 16. Run `npm run typecheck && npm test` in `apps/web`; fix failures.
