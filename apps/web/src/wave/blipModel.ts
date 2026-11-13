// Yjs schema for blips and the decision log: pure read/write helpers over a Y.Doc, no React.
// useWave wraps these; keeping them here lets the merge behavior be tested with plain Y.Docs.
//
// Blip schema (one Y.Map per blip in the "blips" Y.Array):
//   id, parentId, author, kind, createdAt, sources   plain values
//   text          Y.Text
//   attachments   Y.Map<attachmentId, Attachment JSON + order>   (per-attachment last-writer-wins)
//   poll          plain JSON definition (question, options without votes, flags)
//   votes         Y.Map<voterName, optionId[]>   (each voter owns one key, so votes merge cleanly)
//   pollClosed    boolean
//   reactions     Y.Map<"<reactionKey>|<name>", true>   (toggle = set / delete one key)
//   stances       Y.Map<name, Stance>
//   link, code, card   plain JSON
//   pinned, deleted    boolean;  editedAt  number
//   editors       Y.Map<name, lastEditAt>   (non-author editors; one key per person)
// Wave level: "decisions" Y.Array of Decision JSON. The UI only ever sees plain BlipView data.

import * as Y from "yjs";
import { applyDiff } from "./applyDiff";
import { deriveKind } from "./attachments";
import type {
  AgentCardData,
  Attachment,
  BlipKind,
  BlipView,
  CodeSnippet,
  Decision,
  LinkPreview,
  Poll,
  ReactionKey,
  Stance,
} from "./types";

type StoredAttachment = Omit<Attachment, "progress"> & { order: number };
interface StoredPoll {
  id: string;
  question: string;
  options: { id: string; label: string }[];
  multiSelect: boolean;
  anonymous: boolean;
  closesAt?: string;
  hideResultsUntilVoted?: boolean;
}

/** Fields that can ride along when a blip is created. */
export interface NewBlipContent {
  attachments?: Attachment[];
  poll?: Poll;
  link?: LinkPreview;
  code?: CodeSnippet;
  card?: AgentCardData;
}

export interface NewBlip extends NewBlipContent {
  parentId: string | null;
  text: string;
  author: string;
  kind?: BlipKind;
  sources?: string[];
}

/* ---------- Helpers ---------- */

/** Plain JSON for Yjs: drops undefined fields. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function subMap(m: Y.Map<unknown>, key: string): Y.Map<unknown> | undefined {
  const v = m.get(key);
  return v instanceof Y.Map ? (v as Y.Map<unknown>) : undefined;
}

/** Nested maps are created with the blip; this only backfills blips made before they existed. */
function ensureSubMap(m: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const existing = subMap(m, key);
  if (existing) return existing;
  const created = new Y.Map<unknown>();
  m.set(key, created);
  return created;
}

function toStoredAttachment(a: Attachment, order: number): StoredAttachment {
  const { progress: _progress, ...rest } = a;
  // Local blob: URLs mean nothing to other browsers, so they are never written to the doc.
  const url = a.url.startsWith("blob:") ? "" : a.url;
  // Only "uploading" / "done" / "failed" are meaningful to other people.
  const status = a.status === "queued" ? "uploading" : a.status;
  return clean({ ...rest, url, status, order });
}

function toStoredPoll(p: Poll): StoredPoll {
  return clean({
    id: p.id,
    question: p.question,
    options: p.options.map((o) => ({ id: o.id, label: o.label })),
    multiSelect: p.multiSelect,
    anonymous: p.anonymous,
    closesAt: p.closesAt,
    hideResultsUntilVoted: p.hideResultsUntilVoted,
  });
}

export function findBlip(arr: Y.Array<Y.Map<unknown>>, id: string): Y.Map<unknown> | undefined {
  return arr.toArray().find((b) => b.get("id") === id);
}

/* ---------- Reads ---------- */

function readAttachments(m: Y.Map<unknown>): Attachment[] {
  const map = subMap(m, "attachments");
  if (!map) return [];
  const list = Array.from(map.values()) as StoredAttachment[];
  return list
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...a }) => ({ ...a, progress: a.status === "done" ? 100 : 0 }));
}

function readPoll(m: Y.Map<unknown>): Poll | undefined {
  const def = m.get("poll") as StoredPoll | undefined;
  if (!def) return undefined;
  const votes = subMap(m, "votes");
  const byOption = new Map<string, string[]>(def.options.map((o) => [o.id, []]));
  votes?.forEach((value, voter) => {
    for (const optionId of (value as string[] | undefined) ?? []) byOption.get(optionId)?.push(voter);
  });
  return {
    ...def,
    closed: m.get("pollClosed") === true,
    options: def.options.map((o) => ({ ...o, votes: (byOption.get(o.id) ?? []).sort() })),
  };
}

function readReactions(m: Y.Map<unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  subMap(m, "reactions")?.forEach((_v, compound) => {
    const sep = compound.indexOf("|");
    if (sep < 0) return;
    const key = compound.slice(0, sep);
    (out[key] ??= []).push(compound.slice(sep + 1));
  });
  for (const list of Object.values(out)) list.sort();
  return out;
}

function readStances(m: Y.Map<unknown>): Record<string, Stance> {
  const out: Record<string, Stance> = {};
  subMap(m, "stances")?.forEach((v, name) => {
    if (v === "agree" || v === "disagree" || v === "unsure") out[name] = v;
  });
  return out;
}

/** Non-author editors, most recent first (ties broken by name so every client agrees). */
function readEditedBy(m: Y.Map<unknown>): string[] {
  const author = m.get("author");
  const out: Array<[string, number]> = [];
  subMap(m, "editors")?.forEach((at, name) => {
    if (name !== author) out.push([name, typeof at === "number" ? at : 0]);
  });
  return out.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}

export function readBlips(arr: Y.Array<Y.Map<unknown>>): BlipView[] {
  return arr.toArray().map((m) => {
    const attachments = readAttachments(m);
    const poll = readPoll(m);
    const link = (m.get("link") as LinkPreview | undefined) ?? undefined;
    const code = (m.get("code") as CodeSnippet | undefined) ?? undefined;
    const card = (m.get("card") as AgentCardData | undefined) ?? undefined;
    return {
      id: m.get("id") as string,
      parentId: (m.get("parentId") as string | null) ?? null,
      author: m.get("author") as string,
      kind: m.get("kind") as BlipKind,
      text: (m.get("text") as Y.Text | undefined)?.toString() ?? "",
      createdAt: m.get("createdAt") as number,
      sources: (m.get("sources") as string[] | undefined) ?? [],
      contentKind: card ? ("agent-card" as const) : deriveKind({ poll, code, link, attachments }),
      attachments,
      poll,
      link,
      code,
      card,
      reactions: readReactions(m),
      stances: readStances(m),
      pinned: m.get("pinned") === true,
      editedAt: (m.get("editedAt") as number | undefined) ?? undefined,
      editedBy: readEditedBy(m),
      deleted: m.get("deleted") === true,
    };
  });
}

export function readDecisions(arr: Y.Array<Decision>): Decision[] {
  return arr.toArray();
}

/* ---------- Writes ---------- */

export function insertBlip(doc: Y.Doc, arr: Y.Array<Y.Map<unknown>>, opts: NewBlip, id: string, now: number): void {
  const blip = new Y.Map<unknown>();
  doc.transact(() => {
    arr.push([blip]);
    blip.set("id", id);
    blip.set("parentId", opts.parentId);
    blip.set("author", opts.author);
    blip.set("kind", opts.kind ?? "human");
    blip.set("createdAt", now);
    blip.set("sources", opts.sources ?? []);
    blip.set("text", new Y.Text(opts.text));
    // Nested CRDT maps are created up front so concurrent first reactions / votes never race.
    const attachments = new Y.Map<unknown>();
    blip.set("attachments", attachments);
    (opts.attachments ?? []).forEach((a, i) => attachments.set(a.id, toStoredAttachment(a, i)));
    blip.set("reactions", new Y.Map<unknown>());
    blip.set("stances", new Y.Map<unknown>());
    blip.set("votes", new Y.Map<unknown>());
    if (opts.poll) blip.set("poll", toStoredPoll(opts.poll));
    if (opts.link) blip.set("link", clean(opts.link));
    if (opts.code) blip.set("code", clean(opts.code));
    if (opts.card) blip.set("card", clean(opts.card));
  });
}

/** A poll is locked once anyone has voted: its blip can no longer be edited. */
export function hasPollVotes(m: Y.Map<unknown>): boolean {
  if (!m.get("poll")) return false;
  return (subMap(m, "votes")?.size ?? 0) > 0;
}

export function editText(doc: Y.Doc, m: Y.Map<unknown>, text: string, now: number, editor?: string): void {
  const t = m.get("text") as Y.Text | undefined;
  if (!t || hasPollVotes(m)) return;
  doc.transact(() => {
    applyDiff(t, text);
    m.set("editedAt", now);
    // Each editor owns one key, so concurrent edits by different people merge cleanly.
    if (editor && editor !== m.get("author")) ensureSubMap(m, "editors").set(editor, now);
  });
}

export function patchAttachment(m: Y.Map<unknown>, attachmentId: string, patch: Partial<Attachment>): void {
  const map = subMap(m, "attachments");
  const prev = map?.get(attachmentId) as StoredAttachment | undefined;
  if (!map || !prev) return;
  map.set(attachmentId, toStoredAttachment({ ...prev, ...patch, progress: 0 }, prev.order));
}

export function toggleReaction(doc: Y.Doc, m: Y.Map<unknown>, key: ReactionKey, name: string): void {
  const compound = `${key}|${name}`;
  doc.transact(() => {
    const map = ensureSubMap(m, "reactions");
    if (map.has(compound)) map.delete(compound);
    else map.set(compound, true);
  });
}

export function setStance(doc: Y.Doc, m: Y.Map<unknown>, name: string, stance: Stance | null): void {
  doc.transact(() => {
    const map = ensureSubMap(m, "stances");
    if (stance) map.set(name, stance);
    else map.delete(name);
  });
}

/**
 * Single select: picking another option moves the vote; picking the same one clears it.
 * Multi select: toggles the option. Only the voter's own key in "votes" is ever written.
 */
export function castVote(doc: Y.Doc, m: Y.Map<unknown>, voter: string, optionId: string, now: number): void {
  const def = m.get("poll") as StoredPoll | undefined;
  if (!def || m.get("pollClosed") === true) return;
  if (def.closesAt && Date.parse(def.closesAt) <= now) return;
  if (!def.options.some((o) => o.id === optionId)) return;
  doc.transact(() => {
    const votes = ensureSubMap(m, "votes");
    const mine = ((votes.get(voter) as string[] | undefined) ?? []).filter((id) => def.options.some((o) => o.id === id));
    const had = mine.includes(optionId);
    const next = def.multiSelect ? (had ? mine.filter((id) => id !== optionId) : [...mine, optionId]) : had ? [] : [optionId];
    if (next.length === 0) votes.delete(voter);
    else votes.set(voter, next);
  });
}

/** Soft delete: clears the content but keeps the blip so its replies stay in the thread. */
export function softDelete(doc: Y.Doc, m: Y.Map<unknown>): void {
  doc.transact(() => {
    const t = m.get("text") as Y.Text | undefined;
    if (t && t.length > 0) t.delete(0, t.length);
    for (const key of ["poll", "link", "code", "card"]) m.delete(key);
    subMap(m, "attachments")?.clear();
    m.set("pinned", false);
    m.set("deleted", true);
  });
}

/** Append decisions, skipping ones already logged from the same source blip. */
export function appendDecisions(
  arr: Y.Array<Decision>,
  items: Array<Pick<Decision, "text" | "sourceBlipId" | "sourceLabel">>,
  author: string,
  now: number,
  newId: () => string,
): void {
  const existing = arr.toArray();
  const seen = new Set(existing.map((e) => `${e.sourceBlipId ?? ""}\u0000${e.text}`));
  const fresh: Decision[] = [];
  for (const d of items) {
    const text = d.text.trim();
    const key = `${d.sourceBlipId ?? ""}\u0000${text}`;
    if (!text || seen.has(key)) continue;
    seen.add(key);
    fresh.push(clean({ id: newId(), text, createdAt: now, author, sourceBlipId: d.sourceBlipId, sourceLabel: d.sourceLabel }));
  }
  if (fresh.length > 0) arr.push(fresh);
}
