# Design: Multiple waves (private, membership-based)

## Approach

There is **no shared index document**. Each user's inbox is driven by a private
**membership list** in that user's browser (`localStorage`, key `rewave:mywaves`): the ids
of the waves they created or joined. The inbox opens a lightweight background connection to
each joined wave and derives its row summary (title, snippet, counts, participants) from
that wave's own live document. Per-wave metadata (title, createdAt) lives **inside each
wave's `Y.Doc`**, in a `Y.Map` named `meta`.

The React tree is a two-panel shell: `WaveList` (left) driven by `useWaveIndex` (the
membership + background-connection hook), and the existing wave UI (right) driven by
`useWave`. `App.tsx` stays the composition root: it owns the selected wave id (from the
hash), wires list selection to hash changes, and renders the right panel only when a wave
is open.

Joining a wave by id and the share-link / leave UI are owned by spec `07-share-links`; this
spec owns the inbox, the membership list, and per-wave `meta`.

## Data model

### Membership list (`localStorage`, not synced)

- Key `rewave:mywaves` holds a JSON array of records `{ id, joinedAt, lastSeenCount }`.
- This list is **private to the user** and is NEVER synced to the server or other clients
  (R1.5). It is the only source of which waves appear in the inbox.
- Missing / empty / malformed values parse to an empty list without crashing (R1.2).
- Create and join add an id idempotently (dedupe on `id`, keep the original `joinedAt`,
  R1.3); leave removes the id only and never deletes the wave document (R1.4).

### Wave document (`<waveId>`)

Unchanged from spec 01 for content: `Y.Array<Y.Map>` named `blips`. Plus, new in this spec:

- a `Y.Map` named `meta` with `title: string` (may be empty) and `createdAt: number`
  (R2.1). Created with `createdAt = now` and the supplied/empty title on create (R2.2);
  rename edits `meta.title` and all members converge (R2.3).

All row metadata (title, last snippet + author, last activity, blip count, participants) is
derived live from the wave's own `blips` + `meta`, never from a shared index (R2.4).

### Why metadata moved into the wave doc

- Privacy: with no shared index, there is nowhere else a title could live without leaking
  the set of waves to non-members.
- Only someone holding the wave id (a member) can connect and read `meta`.

## Background connections and the shared websocket (R3)

`@hocuspocus/provider` supports a shared transport: construct one
`HocuspocusProviderWebsocket({ url })` and pass it to each `HocuspocusProvider` via the
`websocketProvider` option instead of `url` (the socket multiplexes by document name).

- Every joined wave gets a **lightweight background connection** that reads `blips` + `meta`
  for the row summary and that wave's awareness for the presence dot. On its own, a
  background connection publishes only `user` on awareness, never typing or edit-lock state
  (R3.2).
- The open wave **reuses** its wave's existing background connection (the same
  `HocuspocusProvider` + `Y.Doc`) rather than attaching a second provider, so N listed waves
  plus the open one share a single underlying websocket AND a single provider per wave
  (R3.1). `HocuspocusProviderWebsocket` keys its internal `providerMap` by document name
  (one provider per name), so two providers sharing a wave id on one socket clobber each
  other's message routing — which previously left a just-joined wave stuck on "connecting"
  until an unrelated membership change reshuffled the map. `useMyWaves` exposes `getConn(id)`
  and `useWave` consumes it; while the open wave is up it adds its own typing/edit-lock
  awareness fields to that shared connection and clears them on unmount, so the background
  connection returns to publishing only `user`.
- Each provider owns its own `Awareness` instance, so each wave's presence stays scoped to
  that wave; there is no cross-wave or shared-document awareness.
- When the user leaves a wave or it drops out of the list, its background connection is
  destroyed — no leaked providers (R3.3).
- The shared socket lives for the app's lifetime. If the server is unreachable, the inbox
  shows the last-known state and the page stays usable (R3.4).

## Modules

### `apps/web/src/wave/waveIndex.ts` (pure logic, tested)

No Yjs, no React. Plain functions over plain data so they are unit- and property-testable.

- `type WaveMeta` — the plain per-wave summary record (title, createdAt, lastActivity,
  blipCount, lastSnippet, lastAuthor, participants) derived from a wave's blips + meta.
- `type WaveSummary = WaveMeta & { id: string }` — a row-ready view.
- `applyBlipToMeta(prev, blip)` — pure summary-update logic: bumps count, activity,
  snippet, author, participants; seeds the record when `prev` is undefined.
- `snippetOf(text)` — trim to one line, collapse whitespace, cap length.
- `deriveTitle(summary)` — `meta.title` || first words of snippet || "Untitled wave"
  (R5.2).
- `sortWaves(summaries)` — by `lastActivity` desc, stable tiebreak on id (R5.1).
- `filterWaves(summaries, query)` — case-insensitive title/snippet match, order preserved
  (R5.6).
- `unreadCount(blipCount, lastSeenCount)` — `max(0, blipCount - lastSeenCount)` (R6.1,
  R6.5).

### Membership + unread (`localStorage`)

The membership record carries its own `lastSeenCount`, so unread is private per user
(R6.4). We cannot subtract "your" blips after the fact, so we advance `lastSeenCount`
whenever **this client** adds a blip to a wave (via a callback from `useWave`'s `addBlip`).
Your own posts raise `lastSeenCount` in lockstep with `blipCount`, so they never register as
unread (R6.3). Combined with `unreadCount = max(0, blipCount - lastSeenCount)`, unread is
provably never negative and never counts your own blips.

- `lastSeenCount` lives in the membership record under `rewave:mywaves` (R6.4), not a
  separate per-wave key.
- Opening a wave sets `lastSeenCount = blipCount` (R6.2).

### `apps/web/src/wave/useWaveIndex.ts` (React + Yjs)

- `useWaveIndex(me: { name: string }, openWaveId: string | null)` returns:
  - `waves: WaveSummary[]` — one entry per joined wave, sorted (unfiltered; filtering is a
    pure call in the component), derived from each wave's background connection
  - `presence: Set<string>` — joined wave ids that **another** client currently has open,
    derived from each wave's own awareness (R7)
  - `createWave(title?: string): string` — mint id (format per spec `07-share-links`), add
    to membership, set `meta.createdAt`/`meta.title`, return id (R8)
  - `renameWave(id, title)` — edits that wave's `meta.title` (R9.2)
  - `joinWave(id)` / `leaveWave(id)` — add/remove membership (joining idempotent; leaving
    removes the id and tears down the background connection only). Join UX lives in spec
    `07-share-links`.
  - `markSeenMine(waveId)` — bump `lastSeenCount` because I posted (R6.3)
  - `unreadOf(waveId): number` — reads the membership record + current blipCount
  - `markRead(waveId)` — set `lastSeenCount` to current blipCount (R6.2)
  - `websocket: HocuspocusProviderWebsocket` — the shared socket to hand to `useWave`
- Maintains one lightweight background provider per joined wave on the shared socket;
  derives each row summary from that wave's `blips` + `meta` and the presence dot from that
  wave's awareness (R7.2/R7.4). There is no shared-document awareness.

### `useWave` change (minimal)

- Accept an optional `getConn?: (waveId) => { provider, doc } | null`. When present, reuse
  the inbox's background connection for the wave instead of creating a provider (avoids the
  same-document-name collision on the shared socket). The connection is created by the
  inbox's reconcile effect a tick after join, so `useWave` retries briefly until `getConn`
  returns it, then holds it in state.
- Accept an optional `websocket?: HocuspocusProviderWebsocket` for the fallback path (no
  `getConn`, e.g. tests / single-wave use): build the provider with `{ websocketProvider }`
  instead of `{ url }`. Only a provider `useWave` itself created is destroyed on unmount; a
  reused background connection is owned by `useMyWaves` and left intact.
- Accept an optional `onBlipAdded?: (blip) => void` called from `addBlip` so `App` can feed
  the inbox (`recordBlip` + `markSeenMine`). This keeps `useWave` ignorant of the inbox.
- Reads/writes the wave's `meta` map for the title (used by `WaveTitle`).
- No behavior change to blips, typing, or edit locks.

## Components

- `apps/web/src/components/WaveList.tsx` — left panel: header (New wave button + search
  box), scrollable list, empty state. Keyboard roving-tabindex listbox (arrow keys + Enter,
  R10.4). Prop-only; fed by derived summaries, presence set, and unread counts.
- `apps/web/src/components/WaveListItem.tsx` — one row: derived title, snippet + author,
  relative time, participant avatars (reuses `PresenceBar`/`Avatar`), presence dot, unread
  badge, selected/`aria-current` state.
- `apps/web/src/components/WaveTitle.tsx` — editable title at the top of the open wave
  (R9.2), bound to that wave's `meta.title`. Inline text input styled as a heading; commits
  on blur / Enter.
- `App.tsx` — two-panel shell, hash routing, selection wiring, mobile Back button. Renders
  `Header` once. The open-wave header offers "Copy invite link" and a "Leave wave" action
  (behavior per spec `07-share-links`, R9.4).

Existing components (`BlipNode`, `Composer`, `TypingBubble`, `EmptyState`, `DecisionLog`,
etc.) are reused unchanged inside the right panel.

## Routing (R4)

- Hash is the single source of truth for the open wave: `#<waveId>`. `?name=` still sets
  the name and skips the prompt (R4.4).
- `App` reads `location.hash` into state, listens to `hashchange`, and selection sets
  `location.hash = waveId` (so Back/Forward works via native history, R4.5).
- When the hash names a wave the user is **not** a member of, the Join flow from spec
  `07-share-links` runs instead of opening it directly (R4.2). Clearing to the list sets an
  empty hash (R4.3).
- Backward compatibility: the old `#<wave>/<name>` form is still parsed — the part before
  the first `/` is the wave id; a name after the slash is honored once and stored.

## Layout (R10)

- CSS grid shell `.rw-inbox`: `grid-template-columns: 320px 1fr` at >= 900px.
- < 900px: single column; a `data-view="list" | "wave"` attribute on the shell toggles
  which panel is visible, driven by whether a wave is open. Back button in the open panel
  clears the hash.

## Correctness properties (fast-check)

- P1: For any sequence of blips, `blipCount` equals the number of blips applied, and
  `unreadCount(blipCount, lastSeenCount)` is `>= 0` for any `lastSeenCount` (never negative,
  R6.5).
- P2: If every added blip also advances `lastSeenCount` (the own-blip path), unread stays
  `0` regardless of how many of your own blips you add (never counts own blips, R6.3).
- P3 (unit): `sortWaves` orders by `lastActivity` desc; `filterWaves` keeps only matching
  rows and preserves order; `deriveTitle` applies the three-tier fallback.
- P4 (unit): parsing `rewave:mywaves` tolerates missing/empty/malformed input (empty list,
  no throw, R1.2); join is idempotent and keeps the original `joinedAt` (R1.3).

## Risks / notes

- Per-wave summary scalars are derived live from each wave's doc, so there is no cross-wave
  last-writer-wins hazard; the authoritative content is always the wave's own `blips`/`meta`.
- Background connections scale with the number of joined waves. They share one socket and
  stay lightweight (no typing/edit-lock awareness), but a very large inbox still holds many
  providers; acceptable for small teams per product.md.
- In-memory server persistence still applies (shared with spec 01): a restart clears wave
  content. The membership list survives in `localStorage`, so stale ids can point at waves
  the server no longer has; the row simply shows an empty/last-known summary.
