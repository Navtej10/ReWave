# Product: Rewave

Rewave resurrects Google Wave (2009) as a decision workspace for small teams.
Category: Kiroween 2026 — Resurrection.

## What Wave was
One shared object that was both a conversation and a live document, built from
"blips" (editable, nestable messages), with live typing, playback, robots and federation.

## Why it died (each is a design constraint for us)
1. Nobody knew what it was for -> we target ONE job: turning a debate into a recorded decision.
2. Too noisy and complex -> agents summarize; the decision log is the default view.
3. Needed other people to be useful -> must be fully usable by a single judge (agents are the other participants; paste-in import).
4. Slow and heavy -> keep sync light (Yjs), no federation.

## Rules for every feature
- If a feature does not help a thread end in a decision, cut it.
- Every AI-generated claim links back to the blips it came from.
- Waves are private: no global list of waves or users. A user sees only waves they created
  or joined via a share link (the unguessable wave id is the capability). No accounts or
  passwords.
- Out of scope: federation, gadgets, robot API, email bridge.
