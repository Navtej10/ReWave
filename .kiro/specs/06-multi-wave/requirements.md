
# Requirements: Multiple waves (private, membership-based)

## Introduction

Today Rewave opens exactly one wave, chosen by the URL hash. To behave like Google Wave's
inbox, a user needs a list of the waves they are part of on the left and the open wave on
the right. Crucially, **waves are private**: there is no global list of waves and no global
list of users. A user sees only the waves they created or joined through a share link.

This feature adds a **per-user membership list** (kept in the browser, not synced), a **wave
list panel**, a **two-panel inbox layout**, and moves each wave's metadata (title, createdAt)
*inside that wave's own Yjs document*. The shared "index" document from the earlier draft of
this spec is removed entirely. Joining and sharing are specified in spec
`07-share-links`; this spec owns the inbox and per-wave metadata.

The agents API (`apps/api`) and the inside-a-wave behavior (thread, composer, typing, edit
locks, nested replies) are unchanged.

Scope guardrails (from product.md): this helps a team keep several decisions in flight and
find the right one, so it serves the "turn a debate into a recorded decision" job. Out of
scope for this feature: folders, archive, contacts, extensions, read receipts beyond a
simple unread badge, accounts/passwords, and any server-side directory of waves or users.

## Privacy model (the core change)

- There is **no** shared "index" document. There is **no** server-side list of waves or
  users. Nothing a client publishes names the full set of waves to anyone else.
- A user's list of waves lives only in that user's browser (`localStorage`). A wave becomes
  visible to a user only when they **create** it or **join** it via its id (a share link).
- Wave metadata (title, createdAt) lives **inside each wave's own `Y.Doc`**, in a `Y.Map`
  named `meta`. Only members (people who hold the id) can read it.
- Presence ("someone's here") comes from the **awareness of that specific wave**, never from
  a shared document. No client ever broadcasts the id of a wave it has open to users who are
  not already in that wave.

## Requirements

### R1: Per-user membership list

**User story:** As a team member, I want a private list of just the waves I'm part of, so that I never see waves I wasn't invited to and no one sees mine.

#### Acceptance criteria

1. WHEN the app loads THEN the system SHALL read the current user's joined waves from
   `localStorage` (key `rewave:mywaves`) as a list of records `{ id, joinedAt, lastSeenCount }`.
2. WHEN the stored membership value is missing, empty, or malformed THEN the system SHALL
   treat it as an empty list and SHALL NOT crash.
3. WHEN the user creates or joins a wave THEN that wave's id SHALL be added to the membership
   list; joining a wave already present SHALL be idempotent (no duplicate, `joinedAt` kept).
4. WHEN the user leaves a wave THEN its id SHALL be removed from the membership list only;
   the wave's Yjs document SHALL NOT be deleted and other members SHALL be unaffected.
5. WHERE the membership list is the source of the inbox, the list SHALL NEVER be synced to
   the server or to other clients.

### R2: Per-wave metadata lives in the wave document

**User story:** As a member, I want each wave to carry its own title and creation time, so that the list can show a real title without any global directory.

#### Acceptance criteria

1. WHERE a wave document exists, it SHALL hold a `Y.Map` named `meta` with `title: string`
   (may be empty) and `createdAt: number`.
2. WHEN a wave is created THEN `meta.createdAt` SHALL be set to now and `meta.title` SHALL be
   the supplied title or empty.
3. WHEN a participant renames a wave THEN the rename SHALL edit `meta.title` in that wave's
   document; all members SHALL converge on the new title.
4. WHEN the inbox renders a row for a joined wave THEN its title, last blip snippet and
   author, last activity, blip count, and participants SHALL be derived from that wave's own
   live document (blips + meta), not from any shared index.

### R3: Lightweight background connections, one shared websocket

**User story:** As an operator, I want the inbox to be light on connections, so that showing several joined waves plus the open one does not multiply socket load.

#### Acceptance criteria

1. WHEN the inbox shows N joined waves THEN all background wave connections AND the open
   wave's connection SHOULD share a single underlying websocket (Hocuspocus
   `HocuspocusProviderWebsocket` passed as `websocketProvider`).
2. WHEN a wave is only listed (not open) THEN its background connection SHALL be lightweight:
   it reads blips + meta for the row summary and that wave's awareness for the presence dot,
   and SHALL NOT publish typing or edit-lock state.
3. WHEN the user leaves a wave or it is removed from the list THEN its background connection
   SHALL be destroyed (no leaked providers).
4. IF the sync server is unreachable THEN the inbox SHALL show the last-known state and the
   page SHALL stay usable.

### R4: Open a wave by id (hash routing)

**User story:** As a user, I want a wave's URL to open it directly, so that links and browser Back still work.

#### Acceptance criteria

1. WHEN the hash is `#<waveId>` and the user is already a member THEN the system SHALL open
   that wave in the right panel.
2. WHEN the hash is `#<waveId>` and the user is NOT a member THEN the Join flow in spec
   `07-share-links` SHALL run instead of opening the wave directly.
3. WHEN the hash is empty THEN the system SHALL show the wave list with no wave open (mobile)
   / an empty right-panel prompt (desktop).
4. WHEN the `?name=` query parameter is present THEN the system SHALL use it as the current
   user's name and SHALL skip the name prompt (demo behavior preserved).
5. WHEN the user selects a wave in the list THEN the hash SHALL update to that wave id
   without a full page reload, and browser Back/Forward SHALL restore prior hash state.

### R5: Wave list panel

**User story:** As a user, I want a scannable list of my waves, so that I can pick the one I care about.

#### Acceptance criteria

1. WHEN joined waves exist THEN the list SHALL render one row per joined wave sorted by last
   activity descending.
2. WHERE a wave has a non-empty `meta.title`, the row SHALL show it; ELSE it SHALL fall back
   to the first words of the first blip's snippet; ELSE "Untitled wave".
3. WHEN a row renders THEN it SHALL show a one-line snippet with the last author, a relative
   time from last activity, and up to 3 participant avatars collapsing to `+N`.
4. WHEN the selected wave is open THEN its row SHALL be highlighted and carry `aria-current`.
5. WHEN there are no joined waves THEN the list SHALL show the empty state "No waves yet.
   Start one." with a button that creates a wave.
6. WHEN the user types in the search box THEN the list SHALL filter to rows whose title or
   snippet contains the query (case-insensitive), preserving sort order.

### R6: Unread badge (per user, local)

**User story:** As a user, I want to see which of my waves have new activity I haven't seen, so that I can triage.

#### Acceptance criteria

1. WHERE a joined wave's current blip count exceeds this user's stored `lastSeenCount`, the
   row SHALL show a bold unread badge with that difference.
2. WHEN the user opens a wave THEN it SHALL be marked read (`lastSeenCount` set to the current
   blip count) and the badge SHALL clear.
3. WHEN computing unread THEN the user's own blips SHALL NOT be counted (opening/posting
   advances `lastSeenCount`).
4. WHERE `lastSeenCount` is stored, it SHALL live in the membership record in `localStorage`
   so it survives reloads and stays private to this user.
5. WHEN `lastSeenCount` is missing or larger than the current count THEN unread SHALL be
   clamped so it is never negative.

### R7: Presence on the list (per wave awareness)

**User story:** As a user, I want to see which of my waves someone is currently inside, so that I know where the action is.

#### Acceptance criteria

1. WHEN another client currently has one of my joined waves open THEN that wave's row SHALL
   show a green "someone's here" dot.
2. WHEN presence is determined THEN it SHALL come from the **awareness of that wave's own
   document** (the background connection), NOT from any shared document, and SHALL NOT be
   written into the wave's `Y.Map`s.
3. WHEN a client closes a wave or disconnects THEN its presence SHALL clear for everyone
   still in that wave.
4. WHEN only the current user has a wave open THEN that row SHALL NOT show the dot.

### R8: New wave

**User story:** As a user, I want to start a fresh wave in one click, so that I can capture a new decision.

#### Acceptance criteria

1. WHEN the user clicks "New wave" THEN the system SHALL mint a fresh wave id (see spec
   `07-share-links` for the id format), add it to the membership list, set `meta.createdAt`,
   and open it.
2. WHEN a title is supplied to the create action THEN `meta.title` SHALL use it; ELSE the
   title SHALL start empty and fall back per R5.2.

### R9: Open wave panel

**User story:** As a participant, I want the open wave to work exactly as before plus a renamable title and share/leave controls, so that nothing I rely on regresses.

#### Acceptance criteria

1. WHEN a wave is open THEN the thread, composer, typing indicator, edit locks, and nested
   replies SHALL behave exactly as in the single-wave app.
2. WHEN a wave is open THEN an editable title SHALL appear at the top; any participant MAY
   rename it, updating `meta.title`.
3. WHEN a wave is open THEN the reserved slot above the thread for the decision log panel
   SHALL remain present.
4. WHEN a wave is open THEN the header SHALL offer "Copy invite link" (with a transient
   "Copied" confirmation) and a menu with a "Leave wave" action (spec `07-share-links`).
5. WHEN the user switches from one wave to another THEN no stale typing or editing state
   SHALL carry over: the open-panel's own typing/edit-lock awareness fields SHALL be cleared,
   returning the (reused) background connection to publishing only `user`. The background
   connection itself (owned by the inbox) SHALL remain alive while the wave stays joined; a
   provider is destroyed only when its wave leaves the membership list (R3.3).

### R10: Responsive inbox

**User story:** As a user on any device, I want the layout to fit my screen, so that it's usable on a phone and a laptop.

#### Acceptance criteria

1. WHEN the viewport is >= 900px THEN the list and the open wave SHALL sit side by side, with
   the list about 320px wide.
2. WHEN the viewport is < 900px THEN only one panel SHALL show at a time: the list by
   default, and the open wave (with a Back button) when a wave is open.
3. WHEN the mobile user taps Back THEN the hash SHALL clear and history SHALL behave.
4. WHEN the list renders THEN rows SHALL be keyboard accessible: arrow keys move selection,
   Enter opens.
5. WHEN on mobile THEN interactive targets SHALL be at least 44px.

## Non-goals

- Folders, archive, contacts, extensions/robots, federation.
- Any change to the agents API (`apps/api`) or agent behavior rules.
- Accounts, passwords, or any server-side list of waves or users.
- A shared "index" document (removed — superseded by the per-user membership list).
- Server-side persistence of wave content (inherits the in-memory limitation from spec 01).
