# Rewave

**Google Wave, resurrected.** A shared space where a debate becomes a recorded decision, with AI agents as participants.
Built for Kiroween 2026, category: **Resurrection**.

## The original

Google Wave (2009) fused email, chat and documents into one live object made of editable, nestable
messages called blips. It died because nobody knew what it was for, it was noisy and slow, and it
was useless without other people on it.

## What Rewave fixes

| Why Wave died | What Rewave does |
|---|---|
| No clear purpose | One job: turn a thread into a decision log |
| Noisy and complex | `@scribe` summarizes; every claim links back to its source blip |
| Useless alone | Agents are the other participants; paste in a messy thread to start |
| Heavy sync (operational transformation) | Yjs CRDT, no central transform server |

## Features

- Shared waves with live co-editing and presence
- Inline threaded blips, editable in place
- Agents you summon with `@scribe`, `@skeptic`, `@researcher` (they never speak unprompted)
- Cited answers: agent claims link to the blips they came from

Planned: pinned decision log, catch-up digest, paste-in import, playback. See `.kiro/specs/*/tasks.md`.

## Run it locally

Requirements: Node 20+, Python 3.11+, an Anthropic API key.

```bash
cp .env.example apps/api/.env      # add your ANTHROPIC_API_KEY
npm install

npm run dev:collab                 # terminal 1: sync server on :1234
cd apps/api && python -m venv .venv && source .venv/bin/activate \
  && pip install -r requirements.txt && cd ../.. \
  && npm run dev:api               # terminal 2: agents API on :8000
npm run dev:web                    # terminal 3: app on http://localhost:5173
```

Open `http://localhost:5173/#demo` in two browser windows to see live sync.
Try: post a blip, then reply with `@scribe summarize this`.

```bash
npm run typecheck && npm test      # types + unit + property-based tests
```

## Live demo

- App: _add URL_
- Judge login (if any): _add in the Devpost form, not here_

## How Kiro was used

Fill this in from your real experience. Judges score depth and honesty here.

- **Specs:** `.kiro/specs/` (five feature specs: requirements, design, tasks)
- **Steering:** `.kiro/steering/` (product rules, stack conventions, agent behavior rules, design system)
- **Hooks:** `.kiro/hooks/` (tests on save, spec/README consistency, agent-rule check)
- **MCP:** `.kiro/settings/mcp.json` (fetch server for `@researcher`)
- **Property-based testing:** `apps/web/src/wave/applyDiff.property.test.ts`
- Spec-driven vs. vibe coding: _what you observed_
- Which Kiro surface (IDE / CLI / Web / Crew) and why: _what you used_

## License

MIT, see `LICENSE`.
