# Tasks: Spec export
- [x] 1. Specs: `.kiro/specs/09-spec-export/` (requirements, design, tasks).
- [x] 2. API: `apps/api/spec_export.py` (`validate_spec`, thin rule), `SPEC_EXPORT_PROMPT` in
      `agents.py`, `POST /export/spec` in `main.py` reusing `Limits`, `CallGuard`, `check_size` (R1-R3).
- [x] 3. `apps/api/tests/test_spec_export.py` (pytest): unknown evidence dropped, unsupported
      requirement moved to open questions, thin-thread notice, list caps, HTTP errors and budget (R1-R3).
- [x] 4. `wave/specExport.ts` (pure): `slugify`, `redact`, `renderSpecFiles`, request builder,
      response parser (R4, R5.10).
- [x] 5. `wave/zip.ts` (pure): `makeZip`, no new dependency (R4.8).
- [x] 6. `wave/specExport.test.ts`, `wave/zip.test.ts`, and `wave/specExport.property.test.ts`
      (fast-check): required headings present; wave id and origin never in the output (R4).
- [x] 7. `components/SpecExportView.tsx`, the Export button in `DecisionLog`, wiring in
      `WavePanel` (R5).
- [x] 8. `styles/spec-export.css` (tokens only, 1280px and 390px) (R5.11).
- [x] 9. Steering: add the new files to `.kiro/steering/structure.md`.
- [x] 10. Run `npm run typecheck && npm test` in `apps/web` and `pytest` in `apps/api`; fix failures.
