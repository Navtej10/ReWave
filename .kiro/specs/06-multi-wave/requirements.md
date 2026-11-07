# Requirements: Multiple waves

## Introduction

Today Rewave opens exactly one wave, chosen by the URL hash. To behave like Google Wave's
inbox, a user needs to see every wave they are part of in a list on the left and open a
selected wave on the right. This feature adds a shared **wave index** (one small synced
document that tracks all waves and their metadata), a **wave list panel**, and a two-panel
inbox layout, while leaving the agents API and the inside-a-wave behavior (thread,
composer, typing, edit locks) unchanged.

Scope guardrails (from product.md): this helps a team keep several decisions in flight and
find the right one, so it serves the "turn a debate into a recorded decision" job. Out of
scope for this feature: folders, archive, contacts, extensions, read receipts beyond a
simple unread badge.

## Requirements

### R1: Shared wave index

**User story:** As a team member, I want one place that lists every wave, so that I can see what's in flight without knowing each wave's link.

#### Acceptance criteria

1. WHEN the app loads THEN the system SHALL connect to a shared Yjs document named `index` holding a `Y.Map` of `waveId -> metadata`.
2. WHERE a wave has an index entry, the metadata SHALL include `title`, `createdAt`, `lastActivity`, `blipCount`, `lastSnippet`, `lastAuthor`, and `participants: string[]`.
3. WHEN a blip is added to any wave THEN that wave's index entry SHALL update `lastActivity` (to now), `blipCount` (+1), `lastSnippet` (a trimmed one-line preview of the blip text), `lastAuthor` (the blip author), and SHALL add the author to `participants` if not already present.
4. WHEN a wave receives its first blip and has no index entry yet THEN the system SHALL create an entry with `createdAt` set to now.
5. IF the sync server is unreachable THEN the index SHALL show the last-synced state (possibly empty) and the page SHALL stay usable.

### R2: One shared websocket

**User story:** As an operator, I want the client to be light on connections, so that opening the inbox plus a wave does not double the socket load.

#### Acceptance criteria

1. WHEN the index document and an open wave document are both connected THEN the client SHOULD share a single underlying websocket between them rather than opening two separate connections.
2. WHEN a wave is closed or switched THEN only that wave's document SHALL detach; the shared socket and the index document SHALL stay connected.

### R3: Open a wave by id (hash routing)

**User story:** As a user, I want a wave's URL to open it directly, so that links and browser Back still work.

#### Acceptance criteria

1. WHEN the hash is `#<waveId>` THEN the system SHALL open that wave in the right panel.
2. WHEN the hash is empty THEN the system SHALL show the wave list with no wave open (on mobile) / an empty right panel prompt (on desktop).
3. WHEN the `?name=` query parameter is present THEN the system SHALL use it as the current user's name (preserving today's behavior), and SHALL keep working when it is absent (saved name or prompt).
4. WHEN the user presses the browser Back button after opening a wave THEN the previous hash state SHALL be restored (list on mobile, prior wave or empty on desktop).
5. WHEN the user selects a wave in the list THEN the hash SHALL update to that wave id without a full page reload.

### R4: Wave list panel

**User story:** As a user, I want a scannable list of waves, so that I can pick the one I care about.

#### Acceptance criteria

1. WHEN waves exist THEN the list SHALL render one row per wave sorted by `lastActivity` descending (newest activity first).
2. WHERE a wave has a non-empty `title`, the row SHALL show it; ELSE the row SHALL fall back to the first words of the first blip's snippet; ELSE it SHALL show "Untitled wave".
3. WHEN a row renders THEN it SHALL show a one-line snippet with the last author, a relative time from `lastActivity`, and up to 3 participant avatars (colored initials) collapsing to `+N`.
4. WHEN the selected wave is open THEN its row SHALL be visually highlighted and carry `aria-current`.
5. WHEN there are no waves THEN the list SHALL show the empty state "No waves yet. Start one." with a button that creates a wave.
6. WHEN the user types in the search box THEN the list SHALL filter to rows whose title or snippet contains the query (case-insensitive), preserving sort order.

### R5: Unread badge

**User story:** As a user, I want to see which waves have new activity I haven't seen, so that I can triage.

#### Acceptance criteria

1. WHERE a wave's `blipCount` exceeds the count this user last saw, the row SHALL show a bold unread badge with that difference.
2. WHEN the user opens a wave THEN that wave SHALL be marked read (the last-seen count SHALL be set to the current `blipCount`) and the badge SHALL clear.
3. WHEN computing unread THEN the user's own blips SHALL NOT be counted as unread.
4. WHERE the last-seen count is stored, it SHALL be persisted per wave in `localStorage` so it survives reloads.
5. WHEN the last-seen count is missing or stale (greater than the current count) THEN the unread count SHALL be clamped so it is never negative.

### R6: Presence on the list

**User story:** As a user, I want to see which waves someone is currently inside, so that I know where the action is.

#### Acceptance criteria

1. WHEN another client currently has a wave open THEN that wave's row SHALL show a green "someone's here" dot.
2. WHEN presence is broadcast THEN it SHALL travel over **awareness on the index document** (each client publishes the wave id it has open) and SHALL NOT be written to the index `Y.Map`.
3. WHEN a client closes a wave or disconnects THEN its presence SHALL clear for everyone.
4. WHEN only the current user has a wave open THEN that row SHALL NOT show the dot (presence counts other clients, matching the thread's "just you" rule).

### R7: New wave

**User story:** As a user, I want to start a fresh wave in one click, so that I can capture a new decision.

#### Acceptance criteria

1. WHEN the user clicks "New wave" THEN the system SHALL create a wave with a fresh id, add an index entry, and open it in the right panel.
2. WHEN a title is supplied to the create action THEN the new entry SHALL use it; ELSE the title SHALL start empty and fall back per R4.2.

### R8: Open wave panel

**User story:** As a participant, I want the open wave to work exactly as before plus a renamable title, so that nothing I rely on regresses.

#### Acceptance criteria

1. WHEN a wave is open THEN the thread, composer, typing indicator, and edit locks SHALL behave exactly as in the single-wave app.
2. WHEN a wave is open THEN an editable title SHALL appear at the top; any participant MAY rename it, and renaming SHALL update the index entry's `title`.
3. WHEN a wave is open THEN the reserved slot above the thread for the future decision log panel SHALL remain present.
4. WHEN the user switches from one wave to another THEN the previous wave's provider SHALL be destroyed (no leaked providers) and no stale typing or editing state SHALL carry into the new wave.

### R9: Responsive inbox

**User story:** As a user on any device, I want the layout to fit my screen, so that it's usable on a phone and a laptop.

#### Acceptance criteria

1. WHEN the viewport is >= 900px THEN the list and the open wave SHALL sit side by side, with the list about 320px wide.
2. WHEN the viewport is < 900px THEN only one panel SHALL show at a time: the list by default, and the open wave (with a Back button to the list) when a wave is open.
3. WHEN the mobile user taps Back THEN the hash SHALL clear and the browser history SHALL behave correctly (R3.4).
4. WHEN the list renders THEN rows SHALL be keyboard accessible: arrow keys move the selection and Enter opens the focused wave.
5. WHEN on mobile THEN interactive targets SHALL be at least 44px.

## Non-goals

- Folders, archive, contacts, extensions/robots, federation.
- Any change to the agents API (`apps/api`) or agent behavior rules.
- Server-side persistence of the index (inherits the same in-memory limitation as waves; a
  later task can add Hocuspocus persistence for both).
