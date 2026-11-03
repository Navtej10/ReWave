# Requirements: Agents as participants

## Introduction
Agents replace Wave's "robots". They join the thread as named participants and only act when asked.

## Requirements

### R1: Mention to summon
**User story:** As a participant, I want to @-mention an agent in a blip, so that it responds in the thread.

#### Acceptance criteria
1. WHEN a blip contains `@scribe`, `@skeptic` or `@researcher` THEN that agent SHALL reply as a child blip of the mentioning blip.
2. WHEN no agent is mentioned THEN no agent SHALL post.
3. WHEN text merely looks like a mention (e.g. `email@scribe.com`) THEN no agent SHALL run.

### R2: Cited answers
**User story:** As a reader, I want to see where an agent's claims came from, so that I can check them.

#### Acceptance criteria
1. WHEN an agent replies THEN each cited blip id SHALL be shown as a link to that blip.
2. WHEN an agent cites an id that does not exist THEN the system SHALL drop that citation.

### R3: Graceful failure
#### Acceptance criteria
1. IF the API key is missing or the call fails THEN the UI SHALL show a plain-language error and the human blip SHALL still be posted.

### R4: Roles
1. `@scribe`: decisions, open questions, owners.
2. `@skeptic`: challenges the weakest assumption in at most 3 sentences.
3. `@researcher`: says what facts would settle the question; web tools via MCP.
