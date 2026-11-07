# Design: Inline blips and threading

- Threading is a `parentId` pointer; the UI builds the tree from the flat Y.Array on each render.
- `BlipNode` renders recursively; reply boxes are local UI state.
- Edit rights: any participant may edit an unlocked human blip (inline-blips R2); editing is gated by the awareness-based edit lock from live-wave-sync R5 (one editor at a time, deterministic lowest-clientID winner). A server-side check is out of scope for the hackathon.
- Playback (stretch): sort by `createdAt`, reveal one blip per step.

## Open question
Do we need per-character history for playback? Start with per-blip steps; decide once the demo script is final.
