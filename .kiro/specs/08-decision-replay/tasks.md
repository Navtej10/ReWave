# Tasks: Decision replay

- [x] 1. Steering: add rule 6 to `.kiro/steering/agent-behavior.md` (user-click features may
      call an agent; agents still never post unprompted or edit human blips).
- [x] 2. `wave/replayFrames.ts` (pure): `buildReplayFrames`, `replayEnd` (R1).
- [x] 3. `wave/replayPlayback.ts` (pure): reducer, `initialPlayback`, `dwellMs` (R2).
- [x] 4. `wave/replayFrames.test.ts`, `wave/replayPlayback.test.ts`, and
      `wave/replayFrames.property.test.ts` (fast-check): parent before child or absent,
      frame count <= blip count, cited flags equal `decisionSources` (R1, R2).
- [x] 5. API: `apps/api/narration.py` (`validate_captions`), `NARRATOR_PROMPT` in `agents.py`,
      `POST /agents/narrate` in `main.py` before `/agents/{agent}`, reusing `Limits`,
      `CallGuard`, `check_size` (R3).
- [x] 6. `apps/api/tests/test_narrate.py` (pytest): unknown ids dropped, count capped, order
      enforced, text capped, citations stripped, HTTP errors and budget (R3).
- [x] 7. `wave/replayCaptions.ts` + test: parse/sanitize/`captionAt`/`narrate`/error messages (R3, R4, R5).
- [x] 8. `wave/replays.ts` + test and `useWave.ts`: `replays` Y.Map, `saveReplay` (write only
      if absent or stale, `force` for Regenerate) (R4).
- [x] 9. `components/ReplayView.tsx`, `BlipNode`/`BlipCard` `readOnly` + `markClass`, the
      Replay button in `DecisionLog`, wiring in `WavePanel` (R5, R6).
- [x] 10. `styles/replay.css` (tokens only, 1280px and 390px, reduced motion) (R6.11-R6.12).
- [x] 11. Run `npm run typecheck && npm test` in `apps/web` and `pytest` in `apps/api`; fix failures.
