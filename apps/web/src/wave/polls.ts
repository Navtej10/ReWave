import type { BlipView, Poll, Stance } from "./types";

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 8;

export interface PollValidation {
  valid: boolean;
  question?: string;
  /** One entry per option, aligned by index. */
  options: (string | undefined)[];
  general?: string;
}

/** Question non-empty; 2-8 options; each non-empty; unique (case-insensitive). */
export function validatePoll(question: string, labels: readonly string[]): PollValidation {
  const seen = new Map<string, number>();
  const options = labels.map((raw, i): string | undefined => {
    const label = raw.trim();
    if (!label) return "Option can\u2019t be empty";
    const key = label.toLowerCase();
    if (seen.has(key)) return "Options must be different";
    seen.set(key, i);
    return undefined;
  });
  const result: PollValidation = {
    valid: true,
    question: question.trim() ? undefined : "Ask a question",
    options,
  };
  if (labels.length < POLL_MIN_OPTIONS) result.general = `Add at least ${POLL_MIN_OPTIONS} options`;
  else if (labels.length > POLL_MAX_OPTIONS) result.general = `Use at most ${POLL_MAX_OPTIONS} options`;
  result.valid = !result.question && !result.general && options.every((o) => o === undefined);
  return result;
}

export type ClosePreset = "never" | "1h" | "24h" | "custom";

/** `custom` is a datetime-local string ("2026-11-14T09:30"). */
export function resolveCloseTime(
  preset: ClosePreset,
  nowMs: number,
  custom: string,
): { closesAt?: string; error?: string } {
  if (preset === "never") return {};
  if (preset === "1h") return { closesAt: new Date(nowMs + 3_600_000).toISOString() };
  if (preset === "24h") return { closesAt: new Date(nowMs + 86_400_000).toISOString() };
  const t = Date.parse(custom);
  if (!custom || Number.isNaN(t)) return { error: "Pick a close time" };
  if (t <= nowMs) return { error: "Close time must be in the future" };
  return { closesAt: new Date(t).toISOString() };
}

export function isPollClosed(poll: Poll, nowMs: number = Date.now()): boolean {
  if (poll.closed) return true;
  if (!poll.closesAt) return false;
  const t = Date.parse(poll.closesAt);
  return !Number.isNaN(t) && t <= nowMs;
}

export function votedOptionIds(poll: Poll, voter: string): string[] {
  return poll.options.filter((o) => o.votes.includes(voter)).map((o) => o.id);
}

/**
 * Single select: choosing another option moves your vote; choosing yours again clears it.
 * Multi select: toggles the option.
 */
export function applyVote(poll: Poll, voter: string, optionId: string): Poll {
  if (!poll.options.some((o) => o.id === optionId)) return poll;
  const had = poll.options.find((o) => o.id === optionId)?.votes.includes(voter) ?? false;
  return {
    ...poll,
    options: poll.options.map((o) => {
      const without = o.votes.filter((v) => v !== voter);
      if (o.id === optionId) return { ...o, votes: had ? without : [...without, voter] };
      return poll.multiSelect ? o : { ...o, votes: without };
    }),
  };
}

export interface OptionResult {
  id: string;
  label: string;
  votes: number;
  percent: number;
  voters: string[];
  isLeader: boolean;
}
export interface PollResults {
  totalVotes: number;
  voterCount: number;
  options: OptionResult[];
  /** Every option tied for the most votes (empty when nobody voted). */
  winnerIds: string[];
}

export function pollResults(poll: Poll): PollResults {
  const totalVotes = poll.options.reduce((n, o) => n + o.votes.length, 0);
  const voterCount = new Set(poll.options.flatMap((o) => o.votes)).size;
  const denominator = poll.multiSelect ? voterCount : totalVotes;
  const max = Math.max(0, ...poll.options.map((o) => o.votes.length));
  const winnerIds = max > 0 ? poll.options.filter((o) => o.votes.length === max).map((o) => o.id) : [];
  return {
    totalVotes,
    voterCount,
    winnerIds,
    options: poll.options.map((o) => ({
      id: o.id,
      label: o.label,
      votes: o.votes.length,
      percent: denominator > 0 ? Math.round((o.votes.length / denominator) * 100) : 0,
      voters: o.votes,
      isLeader: winnerIds.length === 1 && winnerIds[0] === o.id,
    })),
  };
}

/** "Option A, 4 votes, 57 percent" */
export function resultSentence(r: OptionResult): string {
  return `${r.label}, ${r.votes} ${r.votes === 1 ? "vote" : "votes"}, ${r.percent} percent`;
}

/** Text for the decision log, or null when nobody voted. */
export function decisionTextForPoll(poll: Poll): string | null {
  const res = pollResults(poll);
  if (res.winnerIds.length === 0) return null;
  const labels = res.options.filter((o) => res.winnerIds.includes(o.id)).map((o) => o.label);
  const verdict = labels.length === 1 ? labels[0] : `tie between ${labels.join(" and ")}`;
  return `${poll.question.trim()} \u2192 ${verdict}`;
}

/* ---------- Stances (per person, per blip) ---------- */

export type StanceCounts = Record<Stance, number>;

/** Counts every person's stance on every live blip. */
export function stanceCounts(blips: readonly BlipView[]): StanceCounts {
  const counts: StanceCounts = { agree: 0, disagree: 0, unsure: 0 };
  for (const b of blips) {
    if (b.deleted) continue;
    for (const s of Object.values(b.stances)) counts[s] += 1;
  }
  return counts;
}

/** "3 agree, 1 disagree, 2 unsure". The scribe receives this same string. */
export function stanceSummaryText(counts: StanceCounts): string {
  const total = counts.agree + counts.disagree + counts.unsure;
  if (total === 0) return "No stances yet";
  return `${counts.agree} agree, ${counts.disagree} disagree, ${counts.unsure} unsure`;
}
