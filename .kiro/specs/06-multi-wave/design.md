# Design: Multiple waves

## Approach

Keep the existing per-wave Yjs document untouched and add one more shared document, named
`index`, that acts as the inbox. The index is a directory of waves, not a container of
their content — it holds small metadata records so the list can render without opening
every wave. Opening a wave still means connecting a `useWave(waveId)` document; the index
just tells us which waves exist and summarizes them.

The React tree becomes a two-panel shell: `WaveList` (left) driven by `useWaveIndex`, and
the existing wave UI (right) driven by `useWave`. `App.tsx` stays the composition root:
it owns the selected wave id (from the hash), wires list selection to hash changes, and
renders the right panel only when a wave is open.

## Data model

### Index document (`index`)

- `Y.Map<Y.Map>` named `waves`, keyed by `waveId`. Each value is a `Y.Map` with plain
  (non-Y.Text) fields:
  - `title: string` (may be empty)
  - `createdAt: number`
  - `lastActivity: number`
  - `blipCount: number`
  - `lastSnippet: string` (trimmed, single line, capped length)
  - `lastAuthor: string`
  - `participants: string[]`
- Metadata values are plain JSON-ish primitives/arrays, not `Y.Text`. A wave entry is
  overwritten as a whole small map on each update; last-writer-wins on these scalar fields
  is acceptable because the authoritative content lives in the wave document, and the index
  is a derived summary.

### Wave document (`<waveId>`)

Unchanged from spec 01: `Y.Array<Y.Map>` named `blips`.

### Why the index is a separate document

- It must be loadable without pulling every wave's full blip history.
- Awareness on the index is the natural home for "who is inside which wave" (R6), separate
  from per-wave awareness (typing / edit locks).

## Shared websocket (R2)

`@hocuspocus/provider` supports a shared transport: construct one
`HocuspocusProviderWebsocket({ url })` and pass it to each `HocuspocusProvider` via the
`websocketProvider` option instead of `url`. Both the index provider and the open wave's
provider attach to the same socket (the socket multiplexes by document name). Each provider
still owns its own `Awareness` instance, so index presence and per-wave typing/edit-lock
awareness stay separate.

- The shared socket and the index provider live for the app's lifetime.
- The wave provider is created/destroyed as the user switches waves; it detaches from the
  shared socket on destroy, leaving the socket and index intact (R2.2, R8.4).

## Modules

### `apps/web/src/wave/waveIndex.ts` (pure logic, tested)

No Yjs, no React. Plain functions over plain data so they are unit- and property-testable.

- `type WaveMeta` — the plain metadata record above.
- `type WaveSummary = WaveMeta & { id: string }` — a row-ready view.
- `applyBlipToMeta(prev: WaveMeta | undefined, blip: { author; text; at }): WaveMeta`
  — pure index-update logic (R1.3/R1.4): bumps count, activity, snippet, author,
  participants; creates the record (with `createdAt`) when `prev` is undefined.
- `snippetOf(text: string): string` — trim to one line, collapse whitespace, cap length.
- `deriveTitle(summary: WaveSummary): string` — title || first words of snippet ||
  "Untitled wave" (R4.2).
- `sortWaves(summaries: WaveSummary[]): WaveSummary[]` — by `lastActivity` desc, stable
  tiebreak on id (R4.1).
- `filterWaves(summaries, query): WaveSummary[]` — case-insensitive title/snippet match,
  order preserved (R4.6).
- `unreadCount(blipCount, lastSeen, ownBlipCountUnknown=false)` → actually:
  `unreadCount(blipCount: number, lastSeen: number): number` — `max(0, blipCount - lastSeen)`
  (R5.1, R5.5). Own-blip exclusion is handled where we mark-read (see below), not here,
  because the index stores only a running `blipCount`.

### Own-blip exclusion (R5.3)

The index only stores a cumulative `blipCount`, so we cannot subtract "your" blips after
the fact. Instead we advance the per-user last-seen counter whenever **this client** adds a
blip to a wave (via a callback from `useWave`'s `addBlip` into the index layer). Effect:
your own posts immediately raise last-seen in lockstep with `blipCount`, so they never
register as unread. Combined with `unreadCount = max(0, blipCount - lastSeen)`, unread is
provably never negative and never counts your own blips.

- `lastSeen` is persisted per wave in `localStorage` under `rewave:seen:<waveId>` (R5.4).
- Opening a wave sets `lastSeen = blipCount` (R5.2).

### `apps/web/src/wave/useWaveIndex.ts` (React + Yjs)

- `useWaveIndex(me: { name: string }, openWaveId: string | null)` returns:
  - `waves: WaveSummary[]` — sorted (unfiltered; filtering is a pure call in the component)
  - `presence: Set<string>` — wave ids that **another** client currently has open (R6)
  - `createWave(title?: string): string` — new id + entry, returns id (R7)
  - `renameWave(id: string, title: string): void` — updates `title` (R8.2)
  - `recordBlip(waveId: string, blip): void` — applies `applyBlipToMeta` into the Y.Map
  - `markSeenMine(waveId: string): void` — bump last-seen because I posted (R5.3)
  - `unreadOf(waveId: string): number` — reads localStorage + current blipCount
  - `markRead(waveId: string): void` — set last-seen to current blipCount (R5.2)
  - `websocket: HocuspocusProviderWebsocket` — the shared socket to hand to `useWave`
- Publishes `openWaveId` on index awareness (`setLocalStateField("openWave", id)`), and
  derives `presence` from other clients' `openWave` fields (R6.2/R6.4).
- The shared `HocuspocusProviderWebsocket` is created once (module-level or stable ref) so
  it survives wave switches.

### `useWave` change (minimal)

- Accept an optional `websocket?: HocuspocusProviderWebsocket`. When present, build the
  provider with `{ websocketProvider }` instead of `{ url }`.
- Accept an optional `onBlipAdded?: (blip) => void` called from `addBlip` so `App` can feed
  the index (`recordBlip` + `markSeenMine`). This keeps `useWave` ignorant of the index.
- No behavior change to blips, typing, or edit locks.

## Components

- `apps/web/src/components/WaveList.tsx` — left panel: header (New wave button + search
  box), scrollable list, empty state. Keyboard roving-tabindex listbox (arrow keys + Enter,
  R9.4). Prop-only; fed by derived summaries, presence set, and unread counts.
- `apps/web/src/components/WaveListItem.tsx` — one row: derived title, snippet + author,
  relative time, participant avatars (reuses `PresenceBar`/`Avatar`), presence dot, unread
  badge, selected/`aria-current` state.
- `apps/web/src/components/WaveTitle.tsx` — editable title at the top of the open wave
  (R8.2). Inline text input styled as a heading; commits on blur / Enter.
- `App.tsx` — two-panel shell, hash routing, selection wiring, mobile Back button. Renders
  `Header` once; the wave-id chip moves into the open panel context.

Existing components (`BlipNode`, `Composer`, `TypingBubble`, `EmptyState`, `DecisionLog`,
etc.) are reused unchanged inside the right panel.

## Routing (R3)

- Hash is the single source of truth for the open wave: `#<waveId>`. `?name=` still sets
  the name.
- `App` reads `location.hash` into state, listens to `hashchange`, and selection sets
  `location.hash = waveId` (so Back works via native history). Clearing to the list sets an
  empty hash.
- Backward compatibility: the old `#<wave>/<name>` form is still parsed — the part before
  the first `/` is the wave id; a name after the slash is honored once and stored.

## Layout (R9)

- CSS grid shell `.rw-inbox`: `grid-template-columns: 320px 1fr` at >= 900px.
- < 900px: single column; a `data-view="list" | "wave"` attribute on the shell toggles
  which panel is visible, driven by whether a wave is open. Back button in the open panel
  clears the hash.

## Correctness properties (fast-check)

- P1: For any sequence of blips, `blipCount` equals the number of blips applied, and
  `unreadCount(blipCount, lastSeen)` is `>= 0` for any `lastSeen` (never negative, R5.5).
- P2: If every added blip also advances `lastSeen` (the own-blip path), unread stays `0`
  regardless of how many of your own blips you add (never counts own blips, R5.3).
- P3 (unit): `sortWaves` orders by `lastActivity` desc; `filterWaves` keeps only matching
  rows and preserves order; `deriveTitle` applies the three-tier fallback.

## Risks / notes

- Index metadata uses last-writer-wins scalars. Two clients posting to the *same* wave at
  the exact same instant could momentarily disagree on `blipCount`; it self-heals on the
  next update and the authoritative content is in the wave doc. Acceptable for a summary.
- In-memory server persistence still applies (shared with spec 01, task 5). A restart
  clears the index. Not addressed here.
