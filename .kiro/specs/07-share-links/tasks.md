
# Tasks: Share links & private access

- [x] 1. `wave/waveId.ts` (pure): `generateWaveId` (>=128 bits via `crypto.getRandomValues`,
      url-safe base64, ~22 chars), `isValidWaveId` (regex + reserved `index`),
      `buildInviteLink`, `parseWaveIdFromHash` (R1, R2, R3).
- [x] 2. Unit tests `wave/waveId.test.ts`: id length/charset/uniqueness; `isValidWaveId`
      accepts generated, rejects empty/short/bad-char/`index`; invite link build + parse
      (incl. legacy `#id/name`) (R1, R2, R3).
- [x] 3. Property test `wave/waveId.property.test.ts` (fast-check): every generated id is
      valid; any string failing `isValidWaveId` is rejected by the server rule (R1.3, R2.3,
      R7.4).
- [x] 4. `components/JoinScreen.tsx` + `components/InvalidLink.tsx`: Join flow UI and the
      invalid-link screen (R4, R5).
- [x] 5. Wire routing in `App.tsx`: member -> open, valid non-member -> JoinScreen, invalid
      -> InvalidLink; `?name=` skips the prompt and auto-joins (R4, R5, R3.4).
- [x] 6. Open-wave header: "Copy invite link" with transient "Copied" and graceful fallback;
      "Leave wave" in a menu (R6, and R9.4 of spec 06).
- [x] 7. Server hardening `apps/collab/src/index.ts`: refuse any document name that fails the
      wave-id rule, explicitly refuse `index`, log rejections, throw in `onConnect`; mirror
      `isValidWaveId` with a comment pointing at the source; no accounts/passwords (R7).
- [x] 8. `styles.css`: Join screen, invalid-link screen, copy/leave header controls + menu.
- [x] 9. Run `npm run typecheck && npm test` (web) and `typecheck` (collab); fix failures.
