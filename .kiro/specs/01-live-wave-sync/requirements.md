# Requirements: Live wave sync

## Introduction
A wave is a shared, real-time space that several people (and agents) edit together.

## Requirements

### R1: Open a shared wave
**User story:** As a team member, I want to open a wave by its link, so that everyone sees the same thread.

#### Acceptance criteria
1. WHEN a user opens the app with `#<waveId>` THEN the system SHALL load that wave and show all its blips.
2. WHEN no id is given THEN the system SHALL use the wave `demo`.
3. IF the sync server is unreachable THEN the system SHALL show a connection status and keep the page usable.

### R2: See others type in real time
**User story:** As a participant, I want to watch edits appear as they happen, so that the wave feels alive.

#### Acceptance criteria
1. WHEN one user edits their blip THEN all other connected users SHALL see the change without refreshing.
2. WHEN two users edit the same blip at once THEN both edits SHALL be preserved and all replicas SHALL converge.
3. WHEN a user joins or leaves THEN the presence list SHALL update.

### R3: Single-player works
**User story:** As a solo evaluator, I want the app to be fully usable alone, so that I can test it without recruiting a partner.

#### Acceptance criteria
1. WHEN only one human is present THEN every feature SHALL still work (agents act as the other participants).
