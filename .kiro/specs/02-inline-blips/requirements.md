# Requirements: Inline blips and threading

## Introduction

Wave's core idea: a reply lives directly under the thing it responds to, and blips can be edited in place.

## Requirements

### R1: Nested replies

**User story:** As a participant, I want to reply directly under a specific blip, so that the discussion stays attached to what it is about.

#### Acceptance criteria

1. WHEN a user clicks Reply on a blip and sends text THEN a child blip SHALL appear directly under it for everyone.
2. WHEN a blip has children THEN they SHALL render indented in creation order.

### R2: Edit in place

**User story:** As a participant, I want to edit any human blip, so that anyone can refine the shared thread without posting a new message.

#### Acceptance criteria

1. WHEN a participant edits a human blip they hold the edit lock on THEN other users SHALL see the change live. (Only one user edits a given blip at a time; see live-wave-sync R5.)
2. WHEN a human blip is not currently locked by another editor THEN any participant SHALL be able to edit it.
3. WHILE another participant holds the edit lock on a human blip THEN that blip SHALL be read-only for everyone else (see live-wave-sync R5).
4. Agent blips SHALL NOT be editable (they stay read-only for everyone).

### R3: Playback (stretch)

**User story:** As a late joiner, I want to replay how the thread evolved, so that I understand how a decision formed.

#### Acceptance criteria

1. WHEN a user opens playback THEN the system SHALL step through blips in creation order.
