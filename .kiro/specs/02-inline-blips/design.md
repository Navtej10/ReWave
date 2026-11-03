# Design: Inline blips and threading

- Threading is a `parentId` pointer; the UI builds the tree from the flat Y.Array on each render.
- `BlipNode` renders recursively; reply boxes are local UI state.
- Edit rights are a UI rule for now (author === me); a server-side check is out of scope for the hackathon.
- Playback (stretch): sort by `createdAt`, reveal one blip per step.

## Open question
Do we need per-character history for playback? Start with per-blip steps; decide once the demo script is final.
