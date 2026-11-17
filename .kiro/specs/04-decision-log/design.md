# Design: Decision log and catch-up

- Decision log is a pinned agent blip (`pinned: true`, to be added to the blip map).
- Last-visit time is stored per wave in the browser; digest = blips with `createdAt` after it, summarized by @scribe.
- Import: split pasted text on blank lines or "From:" markers into blips authored "imported", then call @scribe.

## Open question

Pinned log as a special blip vs. a separate Y.Map. Start with the special blip; revisit if editing gets awkward.

## Traceability and timestamps (R4)

- `Decision` gains two optional fields: `sourceBlipIds?: string[]` and `threadLength?: number`. `sourceBlipId` and `sourceLabel` are unchanged. Both new fields are optional, so stored decisions keep working without migration.
- `appendDecisions` takes an optional context `{ blipIds }` (all blip ids now, in thread order). It sets `threadLength = blipIds.length` on every new decision and `sourceBlipIds = citedIds(text)` filtered to `blipIds` when that is non-empty. The `[b:id]` markers stay in `text`.
- `decisionSources(decision, blipIds)` (`wave/decisionSources.ts`) is the single reader: it returns `decision.sourceBlipIds` when present, otherwise the `[b:id]` markers parsed from `text`; always filtered to existing ids, de-duplicated and in thread order (the order of `blipIds`).
- Dedupe rule in `appendDecisions` (source blip + text) is unchanged. The new fields are derived from the text and the thread, so they do not change what makes two decisions the same.
- UI: `DecisionLog` receives `blips`. It renders `dropUnknownCitations(text, new Set())` (markers removed) and one `.rw-source-chip` button per source, labelled with the blip's author, that calls the existing `onJump`. The inline `RichText` citation chips are no longer shown in decisions, since the markers are removed.
- Export: `decisionsToMarkdown(decisions, title, blips)` appends `(raised in: <unique authors in thread order>)` when a decision has sources.
- Cleanup: the unused placeholder `pages/WavePage/DecisionLog.tsx` is removed; `components/DecisionLog.tsx` is the live one.
