# Requirements: UI visual redesign

## Introduction

The web app has shipped its sync, threading, and agent flows against placeholder styling.
This feature is a complete visual redesign of `apps/web` that turns the functional
prototype into a polished, calm decision workspace in the spirit of Google Wave (2009).
It is UI-only: no change to `useWave`, the agents client, sync logic, or any behavior.
All existing tests must still pass.

The design system that governs this work lives in `.kiro/steering/design.md`.

## Requirements

### R1: Design system as tokens

**User story:** As a developer, I want a single source of truth for color, type, spacing,
radii, shadows, and motion, so that the UI stays consistent and themeable.

#### Acceptance criteria

1. WHEN styles are authored THEN all color, spacing, radius, shadow, and type values SHALL
   come from `--rw-*` CSS custom properties, not hardcoded literals (except the dynamic
   avatar hash color).
2. THE system SHALL use only the OS system font stack; no web fonts are downloaded.
3. THE project SHALL NOT add any UI library or CSS framework.

### R2: Light and dark themes

**User story:** As a user, I want the app to match my OS theme, so that it is comfortable
to read day or night.

#### Acceptance criteria

1. THE light theme SHALL be the default.
2. WHEN the OS requests dark mode (`prefers-color-scheme: dark`) THEN the dark token set
   SHALL apply.
3. Body text SHALL meet WCAG AA contrast against its surface in both themes.

### R3: Responsive layout

**User story:** As a user on desktop or phone, I want the layout to work at both sizes.

#### Acceptance criteria

1. THE layout SHALL be usable and uncluttered at 1280px wide.
2. THE layout SHALL collapse to a single, full-width column at 390px wide with no
   horizontal scroll.
3. ON touch-sized viewports, interactive targets SHALL be at least 44px tall.
4. THE thread SHALL be a centered column no wider than ~760px.

### R4: Accessibility

**User story:** As a keyboard or assistive-technology user, I want the app to be operable
and legible.

#### Acceptance criteria

1. Interactive controls SHALL be real `<button>` elements and SHALL show a visible focus
   ring.
2. Icon-only controls SHALL carry an `aria-label`.
3. Status and presence SHALL convey meaning with text, not color alone.
4. Typing and edit-lock labels SHALL be announced via `aria-live="polite"`.

### R5: Header and presence

**User story:** As a participant, I want to see the wave, connection health, and who is
here at a glance.

#### Acceptance criteria

1. THE header SHALL show the "Rewave" wordmark and a wave id chip.
2. THE header SHALL show a connection status dot with text for connected, connecting, and
   disconnected states.
3. THE header SHALL show presence avatars with hashed-color initials and a `+N` overflow
   avatar when there are too many to show.

### R6: Thread and blips

**User story:** As a participant, I want the conversation to read clearly as a structured
thread.

#### Acceptance criteria

1. Each blip SHALL render as a rounded card with avatar, author name, relative time (from
   `createdAt`, e.g. "2m ago"), and text.
2. Replies SHALL be indented under their parent with a soft connecting line.
3. A blip authored by the current user SHALL be subtly accented.

### R7: Agent blips

**User story:** As a participant, I want to tell human and agent contributions apart
instantly and trace agent claims to their sources.

#### Acceptance criteria

1. Agent blips SHALL use a distinct accent tint and an "agent" badge with an icon.
2. Cited sources SHALL render as chips that link to the cited blip.

### R8: Edit lock state

**User story:** As a participant, I want to know when someone else is editing a blip.

#### Acceptance criteria

1. WHEN another participant holds the edit lock on a blip THEN the UI SHALL show a clear
   "<name> is editing" label with a pencil icon and dim the blip slightly.
2. WHILE a blip is locked by someone else THEN its text box SHALL render in a disabled
   state.

### R9: Typing indicator

**User story:** As a participant, I want to see when someone is composing a reply.

#### Acceptance criteria

1. A typing indicator SHALL render as a pill with three animated dots and the typist's
   name, positioned where the reply will appear.
2. WHEN `prefers-reduced-motion: reduce` is set THEN the dots SHALL be static.

### R10: Composer

**User story:** As a participant, I want a comfortable, always-available way to post.

#### Acceptance criteria

1. THE composer SHALL be sticky at the bottom of the viewport.
2. THE composer textarea SHALL grow with its content.
3. Ctrl/Cmd+Enter SHALL send; a Send button SHALL also send.
4. Quick-insert buttons for @scribe, @skeptic, and @researcher SHALL insert the mention at
   the cursor position.

### R11: Decision log slot

**User story:** As a user, I want a reserved place for the future decision log.

#### Acceptance criteria

1. A collapsible "Decision log" panel SHALL sit above the thread with the empty state
   "No decisions yet. Ask @scribe to summarize."
2. THE panel SHALL contain no logic in this feature (placeholder only).

### R12: Empty and disconnected states

**User story:** As a user, I want clear feedback when the wave is empty or offline.

#### Acceptance criteria

1. WHEN the wave has no blips and no one is typing THEN an empty state SHALL invite the
   first blip.
2. WHEN the connection is not connected THEN a non-blocking banner SHALL surface it
   without preventing interaction.

### R13: Behavior preserved

**User story:** As a maintainer, I want the redesign to change nothing but presentation.

#### Acceptance criteria

1. `useWave`, the agents client, `applyDiff`, and `resolveLocks` SHALL be unchanged.
2. Components SHALL read only plain view objects (no Yjs types), per `tech.md`.
3. `npm run typecheck && npm test` SHALL pass from inside `apps/web`.
