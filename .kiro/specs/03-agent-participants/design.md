# Design: Agents as participants

- Client: `mentionedAgents(text)` detects explicit mentions; `askAgent(name, blips)` posts the thread to the API.
- API: `POST /agents/{agent}` builds a transcript with `[b:<id>]` prefixes, calls the model with that agent's persona, extracts `[b:<id>]` citations, and filters them to known ids.
- Personas live in `apps/api/agents.py`; behavior rules in `.kiro/steering/agent-behavior.md`.
- Agent output is added to the wave as a blip with `kind: "agent"`, so it syncs to everyone like any other blip.

## Risks
- Duplicate agent replies if several clients react to the same mention. Mitigation: only the author's client triggers the call.
- Hallucinated summaries. Mitigation: mandatory citations and dropped unknown ids.
