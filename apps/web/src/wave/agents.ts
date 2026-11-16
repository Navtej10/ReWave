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

/** Agent calls give up after this long so a hung API never leaves a "thinking" row forever. */
export const AGENT_TIMEOUT_MS = 60_000;

const CITE_RE = /\[b:([^\]]+)\]/g;

/** Remove `[b:<id>]` citations whose id is not a real blip (agent-behavior rule 2, client-side backstop). */
export function dropUnknownCitations(text: string, known: ReadonlySet<string>): string {
  return text
    .replace(CITE_RE, (whole, id: string) => (known.has(id) ? whole : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:])/g, "$1")
    .trim();
}

/** Blip ids cited in `text`, in order of first appearance, de-duplicated. */
export function citedIds(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(CITE_RE), (m) => m[1]))];
}

/**
 * Re-validate a reply against the blips we actually sent. The API already filters citations;
 * this keeps the UI honest if it ever returns an id that is not in the thread.
 */
export function sanitizeReply(reply: AgentReply, known: ReadonlySet<string>): AgentReply {
  const clean = (s: string) => dropUnknownCitations(s, known);
  const text = clean(reply.text);
  const card = reply.card;
  let safeCard: AgentCardData | undefined;
  if (card?.agent === "scribe") {
    safeCard = { ...card, summary: clean(card.summary), decisions: card.decisions.map(clean).filter(Boolean) };
  } else if (card?.agent === "skeptic") {
    safeCard = { ...card, counterpoint: clean(card.counterpoint) };
  } else if (card?.agent === "researcher") {
    safeCard = { ...card, summary: card.summary ? clean(card.summary) : card.summary, lookups: card.lookups?.map(clean).filter(Boolean) };
  }
  return { text, sources: citedIds(text).filter((id) => known.has(id)), card: safeCard };
}

/** Plain-language message for a failed agent call. `status` is the HTTP status, absent for network errors. */
export function agentErrorMessage(agent: AgentName, status: number | null, detail: string): string {
  const who = `@${agent}`;
  if (status === null) {
    return `${who} couldn't be reached. Check that the agents API is running, then try again.`;
  }
  if (/GROQ_API_KEY/i.test(detail)) {
    return `${who} can't answer because GROQ_API_KEY is not set. Copy apps/api/.env.example to apps/api/.env, add your key, and restart the API.`;
  }
  if (status === 400) return `${who} has nothing to read yet. Post a message first.`;
  if (status === 404) return `${who} isn't available on this server.`;
  if (status === 413) return `${who} can't read that much at once. ${detail}`.trim();
  if (status === 429 && /daily/i.test(detail)) return `${who} is out of budget for today. Try again tomorrow.`;
  if (status === 429) return `${who} is busy right now. Wait a moment and try again.`;
  return `${who} ran into a problem (error ${status}). Try again in a moment.`;
}

/** FastAPI errors look like `{"detail": "..."}`; fall back to the raw body. */
function detailOf(body: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    // not JSON
  }
  return body;
}

/** One Server-Sent Event from `/agents/{agent}/stream`. */
export interface SseEvent {
  event: string;
  data: string;
}

/** Incremental SSE parser: feed it text chunks as they arrive, get back the complete events. */
export class SseParser {
  private buffer = "";

  push(chunk: string): SseEvent[] {
    this.buffer += chunk.replace(/\r\n?/g, "\n");
    const out: SseEvent[] = [];
    let end: number;
    while ((end = this.buffer.indexOf("\n\n")) >= 0) {
      const block = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length > 0) out.push({ event, data: data.join("\n") });
    }
    return out;
  }
}

interface StreamPayload {
  type?: string;
  message?: string;
  status?: number;
  text?: string;
  sources?: string[];
  card?: AgentCardData | null;
}

export interface AskOptions {
  /** Inactivity timeout: the call fails if the server goes quiet for this long. */
  timeoutMs?: number;
  /** Progress text from the server, e.g. "Reading example.com…". */
  onStatus?: (message: string) => void;
}

export async function askAgent(
  agent: AgentName,
  blips: BlipView[],
  stanceSummary?: string,
  options: AskOptions = {},
): Promise<AgentReply> {
  const live = blips.filter((b) => !b.deleted);
  if (live.length === 0) throw new Error(agentErrorMessage(agent, 400, ""));
  const controller = new AbortController();
  const idleMs = options.timeoutMs ?? AGENT_TIMEOUT_MS;
  let timer = setTimeout(() => controller.abort(), idleMs);
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), idleMs);
  };
  const known = new Set(live.map((b) => b.id));
  try {
    let res: Response;
    try {
      res = await fetch(`/api/agents/${agent}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          blips: live.map((b) => ({ id: b.id, parentId: b.parentId, author: b.author, text: agentTextOf(b) })),
          stances: stanceSummary,
        }),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new Error(`@${agent} took too long to answer. Try again.`);
      throw new Error(agentErrorMessage(agent, null, ""));
    }
    if (!res.ok) throw new Error(agentErrorMessage(agent, res.status, detailOf(await res.text())));
    if (!res.body) throw new Error(`@${agent} ran into a problem. Try again in a moment.`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        touch();
        for (const ev of parser.push(decoder.decode(value, { stream: true }))) {
          const payload = JSON.parse(ev.data) as StreamPayload;
          if (ev.event === "status" && payload.message) options.onStatus?.(payload.message);
          else if (ev.event === "error") throw new Error(agentErrorMessage(agent, payload.status ?? 502, payload.message ?? ""));
          else if (ev.event === "done") {
            return sanitizeReply({ text: payload.text ?? "", sources: payload.sources ?? [], card: payload.card ?? undefined }, known);
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new Error(`@${agent} took too long to answer. Try again.`);
      throw e;
    }
    throw new Error(`The connection to @${agent} dropped before it finished. Try again.`);
  } finally {
    clearTimeout(timer);
  }
}