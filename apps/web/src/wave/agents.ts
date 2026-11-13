import { pollResults } from "./polls";
import type { AgentCardData, AgentName, BlipView } from "./types";

export const AGENT_NAMES: AgentName[] = ["scribe", "skeptic", "researcher"];

/** Returns the agents a human explicitly @-mentioned. Agents never speak unprompted. */
export function mentionedAgents(text: string): AgentName[] {
  return AGENT_NAMES.filter((a) => new RegExp(`(^|\\s)@${a}\\b`, "i").test(text));
}

/**
 * Text an agent reads for one blip: its body plus plain descriptions of rich content, so the
 * scribe can summarize a poll result or a shared file without seeing the bytes.
 */
export function agentTextOf(b: BlipView): string {
  const parts: string[] = [];
  if (b.text.trim()) parts.push(b.text.trim());
  if (b.attachments.length > 0) {
    parts.push(`[attached: ${b.attachments.map((a) => `${a.kind} "${a.alt?.trim() || a.name}"`).join(", ")}]`);
  }
  if (b.poll) {
    const res = pollResults(b.poll);
    const opts = res.options.map((o) => `${o.label}: ${o.votes}`).join("; ");
    parts.push(`[poll${b.poll.closed ? " (closed)" : ""}: "${b.poll.question}" ${opts}]`);
  }
  if (b.link) parts.push(`[link: ${b.link.title} ${b.link.url}]`);
  if (b.code) parts.push(`[code (${b.code.language}):\n${b.code.code}\n]`);
  const stances = Object.entries(b.stances);
  if (stances.length > 0) parts.push(`[stances: ${stances.map(([who, s]) => `${who} ${s}`).join(", ")}]`);
  return parts.join("\n") || "(empty)";
}

export interface AgentReply {
  text: string;
  sources: string[];
  card?: AgentCardData;
}

export async function askAgent(agent: AgentName, blips: BlipView[], stanceSummary?: string): Promise<AgentReply> {
  const res = await fetch(`/api/agents/${agent}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blips: blips
        .filter((b) => !b.deleted)
        .map((b) => ({ id: b.id, parentId: b.parentId, author: b.author, text: agentTextOf(b) })),
      stances: stanceSummary,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`@${agent} failed (${res.status}): ${detail}`);
  }
  const body = (await res.json()) as { text: string; sources: string[]; card?: AgentCardData | null };
  return { text: body.text, sources: body.sources, card: body.card ?? undefined };
}
