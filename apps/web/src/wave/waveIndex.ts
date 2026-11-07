// Pure wave-index logic. No Yjs, no React, no DOM — just plain data transforms so the
// index update, unread, sort, filter and title-fallback rules can be unit- and
// property-tested in isolation. See .kiro/specs/06-multi-wave/design.md.

/** Plain metadata record stored per wave in the shared "index" document. */
export interface WaveMeta {
  title: string;
  createdAt: number;
  lastActivity: number;
  blipCount: number;
  lastSnippet: string;
  lastAuthor: string;
  participants: string[];
}

/** A row-ready view of one wave: its metadata plus its id. */
export type WaveSummary = WaveMeta & { id: string };

/** One blip's contribution to a wave's summary. */
export interface BlipMetaInput {
  author: string;
  text: string;
  at: number;
}

const SNIPPET_MAX = 140;
const TITLE_WORDS = 6;

/** Trim a blip body to a single clean line, capped in length, for the list preview. */
export function snippetOf(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= SNIPPET_MAX) return oneLine;
  return oneLine.slice(0, SNIPPET_MAX - 1).trimEnd() + "…";
}

/**
 * Fold one blip into a wave's metadata. Pure: returns a new record, never mutates `prev`.
 * When `prev` is undefined this is the wave's first blip, so the record is created with
 * `createdAt` set to the blip time (R1.4).
 */
export function applyBlipToMeta(prev: WaveMeta | undefined, blip: BlipMetaInput): WaveMeta {
  const base: WaveMeta = prev ?? {
    title: "",
    createdAt: blip.at,
    lastActivity: blip.at,
    blipCount: 0,
    lastSnippet: "",
    lastAuthor: "",
    participants: [],
  };
  const participants = base.participants.includes(blip.author)
    ? base.participants
    : [...base.participants, blip.author];
  return {
    ...base,
    lastActivity: blip.at,
    blipCount: base.blipCount + 1,
    lastSnippet: snippetOf(blip.text),
    lastAuthor: blip.author,
    participants,
  };
}

/** The first few words of a snippet, used as a title fallback. */
function firstWords(snippet: string, words = TITLE_WORDS): string {
  const parts = snippet.trim().split(/\s+/).filter(Boolean).slice(0, words);
  return parts.join(" ");
}

/**
 * Three-tier title (R4.2): explicit title, else the opening words of the snippet, else
 * "Untitled wave".
 */
export function deriveTitle(summary: Pick<WaveSummary, "title" | "lastSnippet">): string {
  const title = summary.title.trim();
  if (title) return title;
  const fromSnippet = firstWords(summary.lastSnippet);
  if (fromSnippet) return fromSnippet;
  return "Untitled wave";
}

/** Sort by most recent activity first, with a stable tiebreak on id (R4.1). */
export function sortWaves(summaries: WaveSummary[]): WaveSummary[] {
  return [...summaries].sort((a, b) => {
    if (b.lastActivity !== a.lastActivity) return b.lastActivity - a.lastActivity;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Case-insensitive filter over title (derived) and snippet, order preserved (R4.6).
 * An empty/whitespace query returns the list unchanged.
 */
export function filterWaves(summaries: WaveSummary[], query: string): WaveSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return summaries;
  return summaries.filter((s) => {
    const haystack = `${deriveTitle(s)} ${s.lastSnippet}`.toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Unread blips for a viewer: how many blips arrived beyond what they last saw. Clamped at
 * zero so a missing or stale last-seen can never yield a negative count (R5.1, R5.5).
 */
export function unreadCount(blipCount: number, lastSeen: number): number {
  return Math.max(0, blipCount - lastSeen);
}
