# Design: UI visual redesign

## Overview

`App.tsx` currently holds the whole UI (header, composer, recursive blip tree, typing
bubble) plus the post/agent orchestration. The redesign keeps all orchestration in
`App.tsx` but extracts presentation into small, prop-only components under
`apps/web/src/components/`. Styling moves to a tokenized `styles.css` driven by the
design system in `.kiro/steering/design.md`.

No hook, sync, or agent code changes. Components never import Yjs types; they receive the
same plain `BlipView` / `TyperView` objects `useWave()` already returns, plus simple
callbacks.

## Component split (`apps/web/src/components/`)

| Component | Responsibility | Key props |
| --- | --- | --- |
| `Avatar` | Circle with initials, hashed background color | `name`, `size?` |
| `Header` | Wordmark, wave id chip, connection status, presence | `waveId`, `status`, `peers` |
| `PresenceBar` | Avatar row with `+N` overflow | `names`, `max?` |
| `ConnectionStatus` | Dot + text for connected/connecting/disconnected | `status` |
| `DecisionLog` | Collapsible placeholder panel | none |
| `BlipNode` | Recursive blip card + reply box + children | `blip`, `all`, `typers`, `editors`, `isOwn`, callbacks |
| `AgentBadge` | "agent" pill with sparkle icon | none |
| `SourceChips` | Cited source chips linking to `#b-<id>` | `sources` |
| `EditLockLabel` | "<name> is editing" with pencil icon | `name` |
| `TypingBubble` | Animated-dots pill with name | `name` |
| `Composer` | Sticky textarea + Send + quick-insert mentions | `value`, `onChange`, `onSend`, `onInsertMention` |
| `EmptyState` | Invitation to post the first blip | none |
| `DisconnectedBanner` | Non-blocking offline banner | `status` |

Shared helpers go in `components/ui.ts`:

- `relativeTime(ts)` -> "just now" / "2m ago" / "3h ago" / "5d ago".
- `initials(name)` -> up to two uppercase letters.
- `avatarColor(name)` -> deterministic HSL from a simple string hash (the one allowed
  dynamic inline style).
- `isOwnBlip(blip, myName)` -> author equality check.

## App.tsx after the split

`App` keeps: name resolution, `useWave()` call, draft state, `post()` orchestration, and
building the root/child view. It renders `Header`, `DecisionLog`, `DisconnectedBanner`,
the thread (`BlipNode` list + root `TypingBubble`s), `EmptyState`, and `Composer`. The
tree-building logic (`roots`, `children`, `childTypers`) is unchanged.

## Styling approach

- Plain CSS in `styles.css`, organized: reset/base, tokens (`:root` + dark media query),
  layout, then one block per component keyed by `.rw-*` classes.
- Theme via `prefers-color-scheme`; tokens are the only thing that differs between themes.
- Motion: a single `rw-blip-in` keyframe + typing-dot keyframe, both gated behind
  `prefers-reduced-motion`.
- The composer is `position: sticky; bottom: 0` inside the scrolling main column.

## Decisions

- Growing textarea: adjust `rows`/height from `scrollHeight` on input in `Composer`
  (local, presentational; no behavior change to posting).
- Quick-insert: `Composer` exposes an `onInsertMention` that splices the mention at the
  current selection and returns the new string; App owns the draft state.
- Own-blip detection by author-name equality — matches how `peers`/authors already work;
  no id of "me" is exposed by `useWave`.

## Out of scope

Decision-log logic, playback, any change to sync/agents/hooks.
