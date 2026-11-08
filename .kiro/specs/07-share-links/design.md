
# Design: Share links & private access

## Approach

The wave id is the only capability that grants access to a wave. We make it unguessable
(>=128 random bits, URL-safe base64, ~22 chars), validate it with one shared rule, and teach
the sync server to refuse any document name that is not a valid wave id. A non-member who
opens a valid wave link lands on a Join screen; joining writes the wave into their local
membership list (spec 06) and opens it. An invalid link shows a clear error. There are no
accounts — possession of the link is the grant.

## Modules

### `apps/web/src/wave/waveId.ts` (pure, tested)

No React, no DOM dependency beyond `location` in the link helpers (kept thin so the core is
testable in node).

```ts
// 128 bits -> 16 bytes -> 22 url-safe base64 chars (no padding).
const WAVE_ID_BYTES = 16;
const WAVE_ID_LEN = 22;                 // Math.ceil(16 * 4 / 3) with padding stripped
const WAVE_ID_RE = /^[A-Za-z0-9_-]{22}$/;

export function generateWaveId(): string;         // crypto.getRandomValues -> base64url
export function isValidWaveId(id: string): boolean; // regex + reserved-name check ("index")
export function buildInviteLink(waveId: string): string; // `${location.origin}/#${waveId}`
export function parseWaveIdFromHash(hash: string): string | null; // strips '#', takes part before first '/'
```

- `generateWaveId` fills a `Uint8Array(16)` via `crypto.getRandomValues`, then base64url-
  encodes it (`btoa` + replace `+/`->`-_`, strip `=`), giving a fixed 22-char id.
- `isValidWaveId` returns `false` for `"index"` explicitly (defense in depth even though a
  random id never equals it), the empty string, wrong length, or any char outside the set.
- `parseWaveIdFromHash` recovers the id from `#<id>` and the legacy `#<id>/<name>`; returns
  `null` when the hash is empty.

### Shared validity rule for the server

`isValidWaveId` cannot be imported from the web app into `apps/collab` (separate package), so
the server duplicates the rule with a comment pointing at
`apps/web/src/wave/waveId.ts` as the source of truth, and we add a property test asserting the
two rules agree (any string rejected by one is rejected by the other).

### `apps/collab/src/index.ts` (server hardening)

- In Hocuspocus `onConnect({ documentName })`, if `!isValidWaveIdServer(documentName)` then
  `throw new Error(...)` — rejecting the Promise terminates the connection (per Hocuspocus
  hook lifecycle: throwing in `onConnect` stops the chain and closes the socket).
- `index` and any malformed name are refused; refusals are logged with the offending name.
- No auth tokens, accounts, or passwords are introduced.

### `apps/web/src/components/JoinScreen.tsx` (new)

Props: `{ waveId; title: string | null; defaultName: string; onJoin: (name: string) => void;
onCancel: () => void }`.
- Shows the title when known ("Join "<title>"") else a generic "Join this wave".
- Name input prefilled with `defaultName`; Join is disabled until a name is present.
- Enter submits. A "Back to my waves" link calls `onCancel`.

### `apps/web/src/components/InvalidLink.tsx` (new, small)

Static screen: "This invite link isn't valid." + a button back to the user's list.

### Open-wave header controls (in `WavePanel.tsx`)

- "Copy invite link" button: `navigator.clipboard.writeText(buildInviteLink(waveId))`, then
  show "Copied" for ~1.5s. Guarded so a missing clipboard API does not throw.
- Overflow menu (a small `<button>` toggling a `<ul role="menu">`) with "Leave wave" ->
  `onLeave()` -> `leave(id)` in `useMyWaves` -> back to list.

## App routing decision (in `App.tsx`)

On each hash change, compute:
1. `target = parseWaveIdFromHash(location.hash)`.
2. If `target == null` -> show list (no wave).
3. Else if `!isValidWaveId(target)` -> `InvalidLink` screen.
4. Else if the user is a member -> open the wave.
5. Else -> `JoinScreen` for `target` (title via `getMeta(target)` once its background doc
   loads; `?name=` skips the prompt and auto-joins).

`join(target)` adds membership (idempotent) and opening proceeds via the normal path.

## Testing

- `wave/waveId.test.ts`:
  - length is exactly 22 and charset matches the regex over many samples;
  - uniqueness across a large batch (e.g. 10k ids -> 10k distinct);
  - `isValidWaveId` accepts generated ids and rejects `""`, `"index"`, too-short, and
    bad-char strings;
  - `buildInviteLink`/`parseWaveIdFromHash` round-trip, including the legacy `#id/name` form.
- `wave/waveId.property.test.ts` (fast-check):
  - every `generateWaveId()` passes `isValidWaveId`;
  - any arbitrary string that fails `isValidWaveId` is also rejected by the server rule
    (import the server rule or a shared copy into the test).

## Notes / risks

- `btoa` exists in modern browsers and in Node >= 16 globals; tests run on Node, so it is
  available. If a target lacked it we would swap in a small table encoder.
- The capability model means a leaked link grants access until the (future) ability to rotate
  a wave id exists; rotation/expiry is a deliberate non-goal here.
