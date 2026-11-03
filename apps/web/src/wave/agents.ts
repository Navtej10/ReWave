import type { AgentName, BlipView } from "./types";

export const AGENT_NAMES: AgentName[] = ["scribe", "skeptic", "researcher"];

/** Returns the agents a human explicitly @-mentioned. Agents never speak unprompted. */
export function mentionedAgents(text: string): AgentName[] {
  return AGENT_NAMES.filter((a) => new RegExp(`(^|\\s)@${a}\\b`, "i").test(text));
}

export async function askAgent(
  agent: AgentName,
  blips: BlipView[],
): Promise<{ text: string; sources: string[] }> {
  const res = await fetch(`/api/agents/${agent}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blips: blips.map(({ id, parentId, author, text }) => ({ id, parentId, author, text })),
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`@${agent} failed (${res.status}): ${detail}`);
  }
  return res.json();
}
