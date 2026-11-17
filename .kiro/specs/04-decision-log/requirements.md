# Requirements: Decision log and catch-up

## Introduction

This feature gives Rewave its one job: a debate ends as a recorded decision.

## Requirements

### R1: Decision log

**User story:** As a team lead, I want a running list of decisions, open questions and owners, so that I never dig through 40 messages.

#### Acceptance criteria

1. WHEN `@scribe` is invoked THEN the system SHALL let the user pin its summary as the wave's decision log.
2. WHEN a decision is shown THEN it SHALL link to the blips that support it.

### R2: Catch-up digest

**User story:** As a returning participant, I want "what changed since I last looked", so that I can rejoin quickly.

#### Acceptance criteria

1. WHEN a user reopens a wave THEN the system SHALL offer a digest of blips newer than their last visit.

### R3: Import a messy thread

**User story:** As a solo evaluator, I want to paste an email or Slack thread and get a clean wave, so that I see value immediately.

#### Acceptance criteria

1. WHEN a user pastes a long thread THEN the system SHALL create blips from it and run @scribe to produce the decision log.

### R4: Traceable, timestamped decisions

**User story:** As a team lead, I want every decision to point at the human blips it came from and to record how far the thread had got, so that later features (decision replay, spec export) can reconstruct the debate behind it.

#### Acceptance criteria

1. WHEN decisions are added from a scribe card THEN the system SHALL store `sourceBlipIds`, the `[b:id]` citations in the text that match a blip in the wave at that moment.
2. WHEN any decision is added (scribe, poll or manual) THEN the system SHALL store `threadLength`, the number of blips in the wave at that moment.
3. WHEN a stored decision has no `sourceBlipIds` (legacy) THEN the system SHALL derive its sources from the `[b:id]` markers in its text, with no data migration.
4. WHEN a decision is shown THEN the log SHALL display its text without `[b:id]` markers and show each source as a chip (the cited blip's author) that jumps to that blip. A decision with no sources SHALL show no chips.
5. WHEN the log is exported as Markdown THEN citations SHALL appear as readable references, e.g. `(raised in: Asha, Navtej)`, built from the authors of the cited blips.
6. The system SHALL NOT change the agents API.
