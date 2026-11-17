import { agentTextOf, detailOf } from "./agents";
import type { ReplayFrame } from "./replayFrames";

/** Same limits as apps/api/narration.py; keep them in sync. */
export const MAX_REPLAY_CAPTIONS = 6;
export const MAX_REPLAY_CAPTION_CHARS = 280;
export const NARRATE_TIMEOUT_MS = 60_000;

export interface ReplayCaption {
  atBlipId: string;
  text: string;
}

/** What the wave's own Y.Doc stores per decision, in the "replays" Y.Map. */
export interface ReplayEntry {
  captions: ReplayCaption[];
  generatedAt: number;
  frameCount: number;
}

const CITE_RE = /\[b:[^\]]*\]/g;

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.replace(CITE_RE, "").replace(/\s+/g, " ").trim();
  if (text.length <= MAX_REPLAY_CAPTION_CHARS) return text;
  return `${text.slice(0, MAX_REPLAY_CAPTION_CHARS - 1).trimEnd()}\u2026`;
}

/**
 * Keep captions that point at a real frame, once each, in frame order, within the count and length
 * limits. The API already does this; the client repeats it because peers can write to the cache.
 */
export function sanitizeCaptions(raw: unknown, frameIds: readonly string[]): ReplayCaption[] {
  const items = Array.isArray(raw) ? raw : (raw as { captions?: unknown } | null)?.captions;
  if (!Array.isArray(items)) return [];
  const position = new Map(frameIds.map((id, i) => [id, i]));
  const seen = new Set<string>();
  const kept: Array<ReplayCaption & { at: number }> = [];
  for (const item of items as unknown[]) {
    if (typeof item !== "object" || item === null) continue;
    const { atBlipId, text } = item as { atBlipId?: unknown; text?: unknown };
    if (typeof atBlipId !== "string" || !position.has(atBlipId) || seen.has(atBlipId)) continue;
    const clean = cleanText(text);
    if (!clean) continue;
    seen.add(atBlipId);
    kept.push({ atBlipId, text: clean, at: position.get(atBlipId)! });
  }
  kept.sort((a, b) => a.at - b.at);
  return kept.slice(0, MAX_REPLAY_CAPTIONS).map(({ atBlipId, text }) => ({ atBlipId, text }));
}

/** A cache entry from the doc, or null when it is missing or malformed (never throws). */
export function parseReplayEntry(raw: unknown): ReplayEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { captions, generatedAt, frameCount } = raw as Partial<Record<keyof ReplayEntry, unknown>>;
  if (!Array.isArray(captions)) return null;
  if (typeof generatedAt !== "number" || !Number.isFinite(generatedAt)) return null;
  if (typeof frameCount !== "number" || !Number.isInteger(frameCount) || frameCount < 0) return null;
  const valid: ReplayCaption[] = [];
  for (const c of captions as unknown[]) {
    const { atBlipId, text } = (c ?? {}) as { atBlipId?: unknown; text?: unknown };
    if (typeof atBlipId === "string" && typeof text === "string" && text.trim()) valid.push({ atBlipId, text });
  }
  return valid.length > 0 ? { captions: valid, generatedAt, frameCount } : null;
}

/** A stored entry is reusable only for the same number of frames (the thread has not changed shape). */
export function isFresh(entry: ReplayEntry | null | undefined, frameCount: number): entry is ReplayEntry {
  return entry != null && entry.frameCount === frameCount;
}

/** The latest caption written at or before frame `index`; null before the first one. */
export function captionAt(frameIds: readonly string[], captions: readonly ReplayCaption[], index: number): ReplayCaption | null {
  const position = new Map(frameIds.map((id, i) => [id, i]));
  let best: ReplayCaption | null = null;
  let bestAt = -1;
  for (const c of captions) {
    const at = position.get(c.atBlipId);
    if (at !== undefined && at <= index && at > bestAt) {
      best = c;
      bestAt = at;
    }
  }
  return best;
}

export interface NarrateRequestBody {
  blips: Array<{ id: string; author: string; text: string; parentId: string | null }>;
  decision: string;
}

/** What the API gets: frame blips only. A deleted blip's text is never sent. */
export function narrationRequest(frames: readonly ReplayFrame[], decisionText: string): NarrateRequestBody {
  return {
    blips: frames.map(({ blip }) => ({
      id: blip.id,
      author: blip.author,
      text: blip.deleted ? "(deleted)" : agentTextOf(blip),
      parentId: blip.parentId,
    })),
    decision: decisionText.replace(CITE_RE, "").replace(/\s+/g, " ").trim(),
  };
}

/** Plain-language reason a narration failed. `status` is the HTTP status, null for network errors. */
export function narrateErrorMessage(status: number | null, detail: string): string {
  if (status === null) return "Captions couldn't be loaded. Check that the agents API is running.";
  if (/GROQ_API_KEY/i.test(detail)) return "Captions are off because GROQ_API_KEY is not set on the API.";
  if (status === 413) return `This thread is too long to caption. ${detail}`.trim();
  if (status === 429 && /daily/i.test(detail)) return "Captions are out of budget for today.";
  if (status === 429) return "Captions are busy right now. Try again in a moment.";
  if (status === 502 && /no usable captions/i.test(detail)) return "The narrator didn't return usable captions.";
  return `Captions couldn't be written (error ${status}).`;
}

export class NarrateError extends Error {}

/** Ask the API for captions for these frames. Throws NarrateError with a user-facing message. */
export async function narrate(
  frames: readonly ReplayFrame[],
  decisionText: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = NARRATE_TIMEOUT_MS,
): Promise<ReplayCaption[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetchImpl("/api/agents/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(narrationRequest(frames, decisionText)),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new NarrateError("Captions took too long to write.");
      throw new NarrateError(narrateErrorMessage(null, ""));
    }
    if (!res.ok) throw new NarrateError(narrateErrorMessage(res.status, detailOf(await res.text())));
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new NarrateError(narrateErrorMessage(502, ""));
    }
    const captions = sanitizeCaptions(body, frames.map((f) => f.blip.id));
    if (captions.length === 0) throw new NarrateError(narrateErrorMessage(502, "no usable captions"));
    return captions;
  } finally {
    clearTimeout(timer);
  }
}
