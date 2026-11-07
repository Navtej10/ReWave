# Tasks: UI visual redesign

- [x] 1. Document the design system in `.kiro/steering/design.md`
- [x] 2. Write this spec (requirements, design, tasks)
- [x] 3. Implement design tokens in `styles.css` (light + dark, motion, reduced-motion)
- [x] 4. Add `components/ui.ts` helpers (relativeTime, initials, avatarColor, isOwnBlip)
- [x] 5. Build primitives: `Avatar`, `ConnectionStatus`, `PresenceBar`, `AgentBadge`,
       `SourceChips`, `EditLockLabel`, `TypingBubble`, `EmptyState`, `DisconnectedBanner`
- [x] 6. Build `Header`, `DecisionLog`, `Composer`, and recursive `BlipNode`
- [x] 7. Rewrite `App.tsx` to compose the new components (orchestration unchanged)
- [x] 8. Style every component with `.rw-*` classes and tokens
- [x] 9. Verify responsive (1280px / 390px), AA contrast, focus rings, aria-live
- [x] 10. Run `npm run typecheck && npm test` in `apps/web`; fix any failures
- [x] 11. Reconcile docs after the refactor: `structure.md` (new `src/components/`) and
       README (five specs, design-system steering)
