# Tasks: Live wave sync

- [x] 1. Hocuspocus server on port 1234
- [x] 2. `useWave` hook with blips, presence, status
- [x] 3. `applyDiff` helper with unit tests
- [x] 4. Property-based tests for convergence (fast-check)
- [ ] 5. Persist waves (SQLite extension for Hocuspocus) so a restart keeps data
- [ ] 6. Reconnect banner and offline behavior check
- [ ] 7. Deploy sync server and web app; record URL in README
- [x] 8. Typing indicator over awareness (R4): `setTyping` + `typers` in `useWave`, throttled, with reduced-motion-aware dot animation
- [x] 9. Edit locks over awareness (R5): `setEditing` + `editors` in `useWave`, deterministic lock resolution in its own pure, tested module
