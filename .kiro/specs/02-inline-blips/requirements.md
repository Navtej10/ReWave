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
**User story:** As an author, I want to edit my own blip, so that I can refine it without posting a new message.

#### Acceptance criteria
1. WHEN an author edits their own human blip THEN other users SHALL see the change live.
2. WHEN a user views someone else's blip THEN it SHALL be read-only.
3. Agent blips SHALL NOT be editable.

### R3: Playback (stretch)
**User story:** As a late joiner, I want to replay how the thread evolved, so that I understand how a decision formed.

#### Acceptance criteria
1. WHEN a user opens playback THEN the system SHALL step through blips in creation order.
