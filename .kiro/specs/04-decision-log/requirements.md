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
