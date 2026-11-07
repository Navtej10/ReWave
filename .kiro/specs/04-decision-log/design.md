# Design: Decision log and catch-up

- Decision log is a pinned agent blip (`pinned: true`, to be added to the blip map).
- Last-visit time is stored per wave in the browser; digest = blips with `createdAt` after it, summarized by @scribe.
- Import: split pasted text on blank lines or "From:" markers into blips authored "imported", then call @scribe.

## Open question

Pinned log as a special blip vs. a separate Y.Map. Start with the special blip; revisit if editing gets awkward.
