# Design system: Rewave

Rewave is Google Wave (2009) resurrected as a calm decision workspace. The visual
language is a modern take on Wave's original feel: light and airy, soft Wave-blue
accents, rounded cards, a clear conversation structure. Intentional, not templated.
Tone: calm, focused, a place to turn a debate into a recorded decision.

This file is the contract for the UI. When you touch `apps/web/src/styles.css` or any
component under `apps/web/src/components/`, follow these tokens and rules. Do not add UI
libraries or CSS frameworks. System font stack only.

## Principles
- Humans and agents must be instantly distinguishable (separate accent).
- Every surface is a soft, rounded card on an airy background, never heavy chrome.
- Motion is subtle and earns its place; it must respect `prefers-reduced-motion`.
- Light theme is the default; dark theme follows `prefers-color-scheme`.
- Accessibility is not optional: AA contrast, real `<button>`s, visible focus, aria-live.

## Color tokens (CSS variables on `:root`, overridden in dark)

All colors are exposed as `--rw-*` custom properties. Components never hardcode hex.

### Light (default)
| Token | Value | Use |
|---|---|---|
| `--rw-bg` | `#f4f7fb` | app background (airy blue-grey) |
| `--rw-surface` | `#ffffff` | card / panel background |
| `--rw-surface-2` | `#eef3f9` | subtle inset (chips, insets) |
| `--rw-border` | `#dbe3ee` | hairline borders |
| `--rw-text` | `#14202e` | primary text |
| `--rw-text-muted` | `#5a6a7d` | secondary text, timestamps |
| `--rw-accent` | `#1a73e8` | Wave blue — primary accent, links, Send |
| `--rw-accent-weak` | `#e8f0fe` | own-blip tint, accent backgrounds |
| `--rw-accent-strong` | `#1558b0` | hover/active for accent |
| `--rw-agent` | `#7b4ad1` | agent accent (violet) |
| `--rw-agent-weak` | `#f1ebfb` | agent blip tint |
| `--rw-ok` | `#1e8e5a` | connected status dot |
| `--rw-warn` | `#c77700` | connecting status dot |
| `--rw-danger` | `#c0392b` | disconnected dot, errors |
| `--rw-focus` | `#1a73e8` | focus ring color |

### Dark (`prefers-color-scheme: dark`)
| Token | Value |
|---|---|
| `--rw-bg` | `#0e141b` |
| `--rw-surface` | `#182230` |
| `--rw-surface-2` | `#212e3d` |
| `--rw-border` | `#2b3a4d` |
| `--rw-text` | `#e7edf4` |
| `--rw-text-muted` | `#9fb0c3` |
| `--rw-accent` | `#5b9dff` |
| `--rw-accent-weak` | `#1b2b43` |
| `--rw-accent-strong` | `#86b7ff` |
| `--rw-agent` | `#b394f0` |
| `--rw-agent-weak` | `#2a2140` |
| `--rw-ok` | `#49c98a` |
| `--rw-warn` | `#e0a033` |
| `--rw-danger` | `#ef6a5c` |
| `--rw-focus` | `#5b9dff` |

Contrast: body text vs surface meets WCAG AA (>= 4.5:1) in both themes; muted text and
large UI meet AA for their size. Accent-on-white and accent-text pairings were chosen to
clear AA.

## Type scale
System stack only: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.

| Token | Size / line | Use |
|---|---|---|
| `--rw-text-xs` | 12px / 1.4 | chips, badges, timestamps |
| `--rw-text-sm` | 13px / 1.5 | secondary labels, status |
| `--rw-text-base` | 15px / 1.6 | blip body, composer |
| `--rw-text-lg` | 17px / 1.4 | author names, panel titles |
| `--rw-text-xl` | 22px / 1.2 | wordmark |

Weights: 400 body, 600 names/titles, 700 wordmark.

## Spacing scale (4px base)
`--rw-space-1: 4px`, `-2: 8px`, `-3: 12px`, `-4: 16px`, `-5: 24px`, `-6: 32px`, `-7: 48px`.
Thread column max width: `--rw-thread-max: 760px`.

## Radii
`--rw-radius-sm: 8px` (chips, buttons), `--rw-radius-md: 14px` (cards, composer),
`--rw-radius-lg: 20px` (panels), `--rw-radius-pill: 999px` (status dot text, typing bubble, avatars).

## Shadows
`--rw-shadow-sm: 0 1px 2px rgba(20,32,46,.06)` — resting cards.
`--rw-shadow-md: 0 4px 16px rgba(20,32,46,.10)` — composer, floating panels.
Shadows soften, never dominate. In dark theme they lean on borders more than shadow.

## Motion
- Default transition: 150ms ease for color, background, border, transform, opacity.
- New blips fade+rise in: `rw-blip-in` 150ms ease (opacity 0->1, translateY 4px->0).
- Typing dots: 1.4s looping bounce.
- `prefers-reduced-motion: reduce` disables all of the above: no fade-in, static dots.

## Component rules

### Blip card (`.rw-blip`)
Rounded `--rw-radius-md` card on `--rw-surface`, `--rw-shadow-sm`, `--rw-space-3` padding.
Header row: avatar + name (600) + relative time (muted, xs). Body below in base text.
Replies nest inside `.rw-children`, indented with left padding and a soft 2px connecting
line (`--rw-border`). Own blips get a `--rw-accent` left edge and `--rw-accent-weak` tint.

### Agent blip (`.rw-blip--agent`)
`--rw-agent-weak` tint, `--rw-agent` left edge. An "agent" badge (pill, agent color, small
sparkle icon). Cited sources render as chips (`.rw-source-chip`) that link to `#b-<id>`.

### Typing bubble (`.rw-typing`)
WhatsApp-style pill (`--rw-radius-pill`) with three animated dots and the typist's name.
Rendered where the reply will appear (under its target). `aria-live="polite"`.

### Edit-lock label (`.rw-lock`)
Small muted label with a pencil icon: "Asha is editing". The locked blip dims to ~0.7
opacity and its textarea shows a disabled state. `aria-live="polite"`.

### Presence avatar (`.rw-avatar`)
Circle (`--rw-radius-pill`) with the person's initials. Background color is a deterministic
hash of the name (the one allowed dynamic inline style). Overflow collapses to a `+N`
avatar. Min 28px in the header, 32px on a blip.

### Composer (`.rw-composer`)
Sticky to the bottom of the viewport, `--rw-surface` with `--rw-shadow-md`, rounded
`--rw-radius-md`. Growing textarea, a primary Send button (accent), and quick-insert
buttons for @scribe/@skeptic/@researcher that insert the mention at the cursor.
Ctrl/Cmd+Enter sends.

### Decision log panel (`.rw-decisions`)
Reserved slot above the thread. Collapsible card, title "Decision log", empty state
"No decisions yet. Ask @scribe to summarize." No logic yet — placeholder only.

## Accessibility & responsive
- Works at 1280px (comfortable) and 390px (single column, composer full width).
- Touch targets >= 44px on mobile.
- Icon-only buttons carry `aria-label`. Status and presence have text, not color alone.
- Visible focus ring (`2px solid var(--rw-focus)`, offset) on every interactive element.
- No inline styles except the avatar hash color.
