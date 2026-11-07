# Requirements: Live wave sync

## Introduction

A wave is a shared, real-time space that several people (and agents) edit together.

## Requirements

### R1: Open a shared wave

**User story:** As a team member, I want to open a wave by its link, so that everyone sees the same thread.

#### Acceptance criteria

1. WHEN a user opens the app with `#<waveId>` THEN the system SHALL load that wave and show all its blips.
2. WHEN no id is given THEN the system SHALL show the wave list with no wave open (superseded by spec 06 "Multiple waves" R3.2; earlier single-wave builds defaulted to the wave `demo`).
3. IF the sync server is unreachable THEN the system SHALL show a connection status and keep the page usable.

### R2: See others type in real time

**User story:** As a participant, I want to watch edits appear as they happen, so that the wave feels alive.

#### Acceptance criteria

1. WHEN one user edits their blip THEN all other connected users SHALL see the change without refreshing.
2. WHEN edits land on different blips concurrently THEN all edits SHALL be preserved and all replicas SHALL converge. (Concurrent edits to the *same* blip are prevented at the UI by the edit lock in R5; the CRDT still guarantees convergence if they ever occur.)
3. WHEN a user joins or leaves THEN the presence list SHALL update.

### R3: Single-player works

**User story:** As a solo evaluator, I want the app to be fully usable alone, so that I can test it without recruiting a partner.

#### Acceptance criteria

1. WHEN only one human is present THEN every feature SHALL still work (agents act as the other participants).

### R4: Typing indicator

**User story:** As a participant, I want to see when someone else is composing a reply or a new blip, so that the wave feels live and I don't talk over them.

#### Acceptance criteria

1. WHEN a user is typing a reply under a blip THEN every OTHER user SHALL see an animated three-dot bubble directly under that parent blip, labeled "<name> is typing...".
2. WHEN a user is typing a new top-level blip THEN every OTHER user SHALL see the typing bubble at the end of the thread, labeled "<name> is typing...".
3. WHEN a user is typing THEN that same user SHALL NOT see their own typing indicator.
4. WHEN a user sends the blip, empties the input, blurs the input, stays idle for ~4 seconds, or disconnects THEN their typing indicator SHALL clear for everyone.
5. WHEN a user types continuously THEN the system SHALL throttle presence updates rather than broadcast on every keystroke.
6. WHEN the viewer has `prefers-reduced-motion` set THEN the dots SHALL render static (no animation).
7. WHEN typing state is broadcast THEN it SHALL travel over Yjs awareness and SHALL NOT be written to the Y.Doc, so it disappears when the client leaves.

### R5: Edit locks

**User story:** As a participant, I want to know when someone else is already editing a blip, so that we don't fight over the same text.

#### Acceptance criteria

1. WHEN a user focuses a blip's edit box THEN every OTHER user SHALL see that blip become read-only with the label "<name> is editing...".
2. WHEN a user is editing a blip THEN that same user SHALL see no change to their own box.
3. WHEN a blip is being edited THEN at most one user SHALL hold the edit lock at a time.
4. WHEN the editor blurs the box, stays idle for ~10 seconds without keystrokes, or disconnects THEN the lock SHALL release for everyone.
5. WHEN two users claim the same blip at the same moment THEN the system SHALL resolve the winner deterministically (lowest awareness clientID wins) so every client agrees, and the loser's box SHALL become read-only without losing its text.
6. WHEN edit-lock state is broadcast THEN it SHALL travel over Yjs awareness and SHALL NOT be written to the Y.Doc.
