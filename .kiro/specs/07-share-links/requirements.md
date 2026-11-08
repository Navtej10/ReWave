
# Requirements: Share links & private access

## Introduction

Waves are private (see spec `06-multi-wave`): there is no global list of waves or users, and
a user sees only waves they created or joined. The only way a wave reaches a new person is a
**share link** — a URL carrying the wave's unguessable id. This spec owns wave-id generation,
invite-link building/parsing, the Join flow, and the server-side rule that refuses any
document name that is not a valid wave id. There are no accounts or passwords.

Security intent: the wave id is the capability. It must be long and random enough that it
cannot be guessed or enumerated, and the server must refuse to open rooms for anything that
is not a well-formed wave id (so probing for `index`, `admin`, short strings, etc. fails).

## Requirements

### R1: Wave id generation

**User story:** As a user who shares a link, I want the wave id to be unguessable, so that only people I send the link to can open the wave.

#### Acceptance criteria

1. WHEN a wave id is generated THEN it SHALL use `crypto.getRandomValues` with at least 128
   bits of entropy.
2. WHEN a wave id is generated THEN it SHALL be encoded as URL-safe base64 (alphabet
   `A-Z a-z 0-9 - _`, no `+` `/` or `=` padding), yielding about 22 characters for 128 bits.
3. WHEN many ids are generated THEN they SHALL be unique in practice (collisions negligible
   at 128 bits) and SHALL all satisfy `isValidWaveId`.

### R2: Wave id validation

**User story:** As the system, I want one shared rule for what a valid wave id is, so that the client, the stored membership list, and the server all agree.

#### Acceptance criteria

1. WHEN `isValidWaveId(id)` is called THEN it SHALL accept any id produced by
   `generateWaveId()`.
2. WHEN `isValidWaveId(id)` is called THEN it SHALL reject the empty string, strings shorter
   than the minimum length, strings containing characters outside `A-Z a-z 0-9 - _`, and the
   reserved name `index`.
3. WHERE the server enforces the same rule, it SHALL either import the shared rule or
   duplicate it with a comment pointing at the source of truth, so the two cannot drift.

### R3: Invite link building and parsing

**User story:** As a member, I want a one-click link I can paste anywhere, so that inviting someone is trivial.

#### Acceptance criteria

1. WHEN `buildInviteLink(waveId)` is called THEN it SHALL return `${location.origin}/#${waveId}`.
2. WHEN a URL of the form `.../#<waveId>` is opened THEN parsing the hash SHALL recover
   exactly `<waveId>`.
3. WHEN the hash additionally carries a legacy `#<waveId>/<name>` form THEN parsing SHALL
   still recover `<waveId>` (the part before the first `/`).
4. WHEN `?name=<n>` is present on an invite URL THEN the name SHALL be used and the Join
   screen's name prompt SHALL be skipped (demo behavior).

### R4: Join flow for a non-member

**User story:** As someone who received a link, I want a clear way to join the wave, so that it appears in my list and opens.

#### Acceptance criteria

1. WHEN the hash names a valid wave id that the current user has NOT joined THEN the system
   SHALL show a Join screen instead of opening the wave.
2. WHEN the Join screen renders THEN it SHALL show the wave's title if it can be loaded from
   the wave document, a name field prefilled from `localStorage` (`rewave:name`), and a Join
   button.
3. WHEN the user clicks Join THEN the system SHALL save the entered name, add the wave to the
   user's membership list (idempotently), and open the wave.
4. WHEN `?name=` is present THEN the Join screen SHALL skip the name prompt and MAY join
   immediately (demo behavior), still adding the wave to the membership list.
5. WHEN the user is already a member of the hashed wave THEN no Join screen SHALL appear and
   the wave SHALL open directly.

### R5: Invalid link handling

**User story:** As a user who followed a broken or tampered link, I want a clear message, so that I'm not stuck on a blank screen.

#### Acceptance criteria

1. WHEN the hash is present but fails `isValidWaveId` THEN the system SHALL show a screen
   reading "This invite link isn't valid" with a way back to the user's own list.
2. WHEN the invalid screen is shown THEN the system SHALL NOT add anything to the membership
   list and SHALL NOT open a wave.

### R6: Copy invite link from an open wave

**User story:** As a member in a wave, I want to copy its invite link quickly, so that I can share it.

#### Acceptance criteria

1. WHEN a wave is open THEN the header SHALL show a "Copy invite link" control.
2. WHEN the user activates it THEN `buildInviteLink(waveId)` SHALL be written to the clipboard
   and a transient "Copied" confirmation SHALL appear.
3. WHERE the clipboard API is unavailable THEN the action SHALL fail gracefully (no crash);
   it MAY fall back to selecting the link text.

### R7: Server refuses non-wave document names

**User story:** As an operator, I want the sync server to open rooms only for real wave ids, so that nobody can probe for or create arbitrary shared documents.

#### Acceptance criteria

1. WHEN a client connects with a document name that fails the wave-id validity rule THEN the
   server SHALL refuse the connection by throwing in the appropriate Hocuspocus connection
   hook.
2. WHEN a client connects with the reserved name `index` THEN the server SHALL explicitly
   refuse it (the shared `index` document no longer exists).
3. WHEN a connection is refused THEN the server SHALL log the rejected document name.
4. WHERE the server's validity rule lives, it SHALL match `isValidWaveId` (shared or mirrored
   with a comment pointing at the source, per R2.3).
5. WHEN hardening the server THEN NO accounts or passwords SHALL be added.

## Non-goals

- Accounts, passwords, roles, or revocable/expiring links (the id is the capability).
- Any server-side list of waves, users, or memberships.
- Changing the agents API (`apps/api`) or agent behavior rules.
- Encryption of wave content at rest (out of scope; in-memory sync per spec 01).
